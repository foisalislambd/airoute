import json
import os
import re
import subprocess
import sys

SEMVER = re.compile(r"^[vV]?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?$")
PACKAGE_SEMVER = re.compile(r"^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$")


def parse_version(value):
    match = SEMVER.fullmatch(value.strip())
    if not match:
        return None
    major, minor, patch, pre = match.groups()
    if pre is None:
        pre_key = (1, ())
    else:
        parts = []
        for ident in pre.split("."):
            if ident.isdigit():
                parts.append((0, int(ident)))
            else:
                parts.append((1, ident))
        # A release sorts above every prerelease with the same numbers.
        pre_key = (0, tuple(parts))
    return (int(major), int(minor or 0), int(patch or 0), pre_key)


def highest(versions):
    best = None
    best_raw = ""
    for raw in versions:
        parsed = parse_version(raw)
        if parsed is None:
            continue
        if best is None or parsed > best:
            best = parsed
            best_raw = raw.strip()
    return best, best_raw


def should_release(package_version, messages, published):
    parsed = parse_version(package_version)
    if parsed is None:
        raise SystemExit(f"package.json version must look like 1.2.3, got {package_version!r}")
    blob = "\n".join(messages).lower()
    if "skip release" in blob:
        return False, "commit message contains skip release"
    current, current_raw = highest(published)
    if current is None:
        return True, "no published version yet"
    if parsed <= current:
        return False, f"{package_version} is not newer than {display_version(current_raw)}"
    return True, f"{package_version} is newer than {display_version(current_raw)}"


def display_version(raw):
    text = raw.strip()
    if text[:1] in ("v", "V"):
        text = text[1:]
    return text or raw.strip()


def load_event():
    path = os.environ.get("GITHUB_EVENT_PATH", "")
    if not path or not os.path.isfile(path):
        return {}
    with open(path, encoding="utf-8") as handle:
        event = json.load(handle)
    return event if isinstance(event, dict) else {}


def commit_messages():
    event = load_event()
    before = str(event.get("before") or "")
    after = str(event.get("after") or "")
    if before and after and set(before) != {"0"}:
        log = subprocess.run(
            ["git", "log", f"{before}..{after}", "--format=%B%x1e"],
            check=False,
            capture_output=True,
            text=True,
        )
        if log.returncode != 0:
            raise SystemExit(log.stderr.strip() or "could not read pushed commits")
        return [part.strip("\n") for part in log.stdout.split("\x1e") if part.strip()]
    messages = []
    head = event.get("head_commit") or {}
    if isinstance(head, dict) and head.get("message"):
        messages.append(head["message"])
    for commit in event.get("commits") or []:
        if isinstance(commit, dict) and commit.get("message"):
            messages.append(commit["message"])
    return messages


def published_versions():
    found = []
    tags = subprocess.run(["git", "tag", "--list"], check=False, capture_output=True, text=True)
    if tags.returncode == 0:
        found.extend(line.strip() for line in tags.stdout.splitlines() if line.strip())
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    if not (repo and os.environ.get("GH_TOKEN")):
        return found
    for kind, field in (("releases", "tag_name"), ("tags", "name")):
        page = 1
        while page <= 20:
            response = subprocess.run(
                ["gh", "api", f"repos/{repo}/{kind}?per_page=100&page={page}"],
                check=False,
                capture_output=True,
                text=True,
            )
            if response.returncode != 0:
                detail = response.stderr.strip() or response.stdout.strip()
                raise SystemExit(detail or f"could not read GitHub {kind}")
            try:
                payload = json.loads(response.stdout or "[]")
            except json.JSONDecodeError as err:
                raise SystemExit(f"could not read GitHub {kind}: {err}") from err
            if not isinstance(payload, list):
                raise SystemExit(f"could not read GitHub {kind}")
            if not payload:
                break
            for item in payload:
                if isinstance(item, dict):
                    name = item.get(field) or ""
                    if name:
                        found.append(name)
            if len(payload) < 100:
                break
            page += 1
    return found


def package_version():
    with open("package.json", encoding="utf-8") as handle:
        data = json.load(handle)
    version = str(data.get("version", "")).strip()
    if PACKAGE_SEMVER.fullmatch(version) is None:
        raise SystemExit(f"package.json version must look like 1.2.3, got {version!r}")
    return version


def set_output(key, value):
    line = f"{key}={value}"
    path = os.environ.get("GITHUB_OUTPUT", "")
    if path:
        with open(path, "a", encoding="utf-8") as handle:
            handle.write(line + "\n")
    print(line)


def main():
    version = package_version()
    release, reason = should_release(version, commit_messages(), published_versions())
    set_output("release", "true" if release else "false")
    set_output("version", version)
    set_output("tag", f"v{version}")
    set_output("reason", reason)
    summary = os.environ.get("GITHUB_STEP_SUMMARY", "")
    if summary:
        with open(summary, "a", encoding="utf-8") as handle:
            handle.write(f"### Release\n\n{reason}\n")
    print(reason)
    return 0


if __name__ == "__main__":
    sys.exit(main())
