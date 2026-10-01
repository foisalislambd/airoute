"""Download a logo for every provider, store a small SVG, and refresh the lookup."""

from __future__ import annotations

import base64
import io
import json
import re
import ssl
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urlparse

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps" / "panel" / "public" / "providers"
CATALOG = ROOT / "apps" / "server" / "internal" / "catalog"
TS = ROOT / "apps" / "panel" / "src" / "lib" / "provider-icons.ts"
PROVIDERS = ROOT / "docs" / "all-llm-provider-list" / "data" / "providers.json"

ALIASES = {
    "azure-openai": "azure",
    "azure-cognitive-services": "azure",
    "baidu-qianfan": "baidu",
    "cloudflare-workers-ai": "cloudflare",
    "cloudflare-playground": "cloudflare",
    "cloudflare-ai-gateway": "cloudflare",
    "dashscope": "qwen",
    "google-ai-studio": "google",
    "nvidia-nim": "nvidia",
    "snowflake-cortex": "snowflake",
    "together-ai": "together",
    "x-ai": "xai",
    "chatgpt-web": "openai",
    "chatgpt-web-codex": "openai",
    "codex-cloud": "openai",
    "codex-app-server": "codex",
    "claude-code": "claude",
    "gemini-web": "gemini",
    "gemini-business": "gemini",
    "github-copilot": "copilot",
    "github-models": "copilot",
    "ollama-cloud": "ollama",
    "ollama-search": "ollama",
    "deepseek-web": "deepseek",
    "grok-web": "grok",
    "grok-cli": "grok",
    "xai-oauth": "xai",
}

CTX = ssl.create_default_context()


def catalog_slugs() -> set[str]:
    text = (CATALOG / "catalog_generated.go").read_text(encoding="utf-8")
    text += (CATALOG / "catalog.go").read_text(encoding="utf-8")
    return set(re.findall(r'Slug:\s+"([^"]+)"', text))


def websites() -> dict[str, str]:
    rows = json.loads(PROVIDERS.read_text(encoding="utf-8"))
    return {row["slug"]: row.get("website") or "" for row in rows}


def minify(svg: str) -> str:
    svg = re.sub(r"<!--.*?-->", "", svg, flags=re.S)
    svg = re.sub(r"<metadata[\s\S]*?</metadata>", "", svg, flags=re.I)
    svg = re.sub(r">\s+<", "><", svg)
    svg = re.sub(r"\s+", " ", svg)
    return svg.strip()


def is_white(svg: str) -> bool:
    colors = re.findall(r"(?:fill|stroke)\s*[:=]\s*['\"]?([^;'\"\s]+)", svg, flags=re.I)
    kept = []
    for color in colors:
        value = color.strip().lower()
        if value in {"none", "transparent", "currentcolor"}:
            continue
        kept.append(value)
    if not kept:
        return False
    return all(value in {"#fff", "#ffffff", "white"} for value in kept)


def domain(website: str) -> str:
    host = (urlparse(website).hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "AIRoute icon fetch"})
    with urllib.request.urlopen(request, timeout=12, context=CTX) as response:
        data = response.read(1_500_000)
        kind = response.headers.get_content_type()
    if kind.startswith("text/html"):
        raise ValueError("html")
    return data


def to_svg(data: bytes) -> str | None:
    text = ""
    if data.lstrip().startswith(b"<") or data.lstrip().startswith(b"<?xml"):
        text = data.decode("utf-8", errors="ignore")
    if "<svg" in text.lower():
        small = minify(text)
        if "<svg" not in small.lower() or len(small) > 80_000:
            return None
        return small
    try:
        image = Image.open(io.BytesIO(data))
    except Exception:
        return None
    image = image.convert("RGBA")
    image.thumbnail((64, 64), Image.Resampling.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    width, height = image.size
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}">'
        f'<image href="data:image/png;base64,{encoded}" width="{width}" height="{height}"/></svg>'
    )


def read_url(url: str) -> tuple[str, bytes]:
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=12, context=CTX) as response:
        return response.headers.get_content_type(), response.read(1_500_000)


def page_icons(website: str) -> list[str]:
    host = domain(website)
    if not host or not website.startswith("http"):
        return []
    try:
        _, raw = read_url(website)
    except Exception:
        raw = b""
    text = raw.decode("utf-8", errors="ignore")
    found = re.findall(r'rel=["\'][^"\']*icon[^"\']*["\'][^>]*href=["\']([^"\']+)', text, flags=re.I)
    found += re.findall(r'href=["\']([^"\']+)["\'][^>]*rel=["\'][^"\']*icon', text, flags=re.I)
    urls = []
    origin = f"{urlparse(website).scheme}://{urlparse(website).netloc}"
    for href in found:
        if href.startswith("data:"):
            continue
        if href.startswith("//"):
            href = "https:" + href
        elif href.startswith("/"):
            href = origin + href
        elif not href.startswith("http"):
            href = origin + "/" + href
        urls.append(href)
    urls.append(origin + "/favicon.ico")
    urls.append(origin + "/apple-touch-icon.png")
    return urls


def candidates(slug: str, website: str) -> list[str]:
    urls = [
        f"https://cdn.simpleicons.org/{slug}",
        f"https://cdn.jsdelivr.net/npm/simple-icons/icons/{slug}.svg",
    ]
    host = domain(website)
    if host:
        urls.append(f"https://www.google.com/s2/favicons?domain={host}&sz=64")
        urls.append(f"https://icons.duckduckgo.com/ip3/{host}.ico")
        urls.append(f"https://unavatar.io/{host}")
        parts = host.split(".")
        if len(parts) > 2:
            urls.append(f"https://unavatar.io/{'.'.join(parts[-2:])}")
    urls.extend(page_icons(website))
    return urls


def monogram(slug: str) -> str:
    letter = (slug[:1] or "?").upper()
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
        '<rect width="64" height="64" rx="14" fill="#4f46e5"/>'
        f'<text x="32" y="42" text-anchor="middle" font-family="Arial,sans-serif" font-size="32" fill="#fff">{letter}</text>'
        "</svg>"
    )


def download(slug: str, website: str) -> str | None:
    for url in candidates(slug, website):
        try:
            svg = to_svg(fetch(url))
        except Exception:
            continue
        if svg:
            return svg
    return None


def resolve(slug: str, icons: set[str]) -> str | None:
    if slug in icons:
        return slug
    alias = ALIASES.get(slug)
    if alias and alias in icons:
        return alias
    head = slug.split("-", 1)[0]
    if head in icons:
        return head
    return None


def write_ts(icons: dict[str, bool], lookup: dict[str, str]) -> None:
    lines = [
        "export type ProviderIcon = { file: string; white: boolean }",
        "",
        "const icons: Record<string, ProviderIcon> = {",
    ]
    for stem, white in icons.items():
        lines.append(f"  {json_key(stem)}: {{ file: {quote(stem)}, white: {'true' if white else 'false'} }},")
    lines.extend(["}", "", "const aliases: Record<string, string> = {"])
    for slug, stem in lookup.items():
        if slug != stem:
            lines.append(f"  {json_key(slug)}: {quote(stem)},")
    lines.extend(
        [
            "}",
            "",
            "export function providerIcon(slug: string): ProviderIcon | null {",
            "  const file = aliases[slug] ?? slug",
            "  return icons[file] ?? null",
            "}",
            "",
        ]
    )
    TS.write_text("\n".join(lines), encoding="utf-8")


def quote(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def json_key(value: str) -> str:
    if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", value):
        return value
    return quote(value)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    before = 0
    after = 0
    for path in OUT.glob("*.svg"):
        raw = path.read_text(encoding="utf-8")
        before += len(raw.encode())
        if "base64," in raw:
            after += len(raw.encode())
            continue
        small = minify(raw)
        if "<svg" not in small.lower():
            after += len(raw.encode())
            continue
        path.write_text(small, encoding="utf-8")
        after += len(small.encode())

    sites = websites()
    slugs = catalog_slugs()
    have = {path.stem for path in OUT.glob("*.svg")}
    missing = [slug for slug in sorted(slugs) if resolve(slug, have) is None]
    saved = 0
    with ThreadPoolExecutor(max_workers=12) as pool:
        futures = {pool.submit(download, slug, sites.get(slug, "")): slug for slug in missing}
        for future in as_completed(futures):
            slug = futures[future]
            svg = future.result() or monogram(slug)
            (OUT / f"{slug}.svg").write_text(svg, encoding="utf-8")
            saved += 1
            after += len(svg.encode())

    icons = {path.stem: is_white(path.read_text(encoding="utf-8")) for path in sorted(OUT.glob("*.svg"))}
    stems = set(icons)
    lookup = {}
    for slug in sorted(slugs):
        file = resolve(slug, stems)
        if file:
            lookup[slug] = file
    write_ts(icons, lookup)
    print(f"recompressed {before} -> {after} bytes; downloaded {saved}; icons {len(icons)}; matched {len(lookup)}/{len(slugs)}")


if __name__ == "__main__":
    main()
