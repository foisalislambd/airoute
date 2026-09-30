"""Copy provider SVGs into the panel and write a slug lookup."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "OmniRoute" / "public" / "providers"
OUT = ROOT / "apps" / "panel" / "public" / "providers"
CATALOG = ROOT / "apps" / "server" / "internal" / "catalog"
TS = ROOT / "apps" / "panel" / "src" / "lib" / "provider-icons.ts"

ALIASES = {
    "azure-openai": "azure",
    "azure-cognitive-services": "azure",
    "baidu-qianfan": "baidu",
    "cloudflare-workers-ai": "cloudflare",
    "cloudflare-playground": "cloudflare",
    "dashscope": "qwen",
    "google-ai-studio": "google",
    "nvidia-nim": "nvidia",
    "snowflake-cortex": "snowflake",
    "together-ai": "together",
    "x-ai": "xai",
}


def minify(svg: str) -> str:
    svg = re.sub(r"<!--.*?-->", "", svg, flags=re.S)
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
    return all(value in {"#fff", "#ffffff", "white", "#fff"} for value in kept)


def catalog_slugs() -> set[str]:
    text = (CATALOG / "catalog_generated.go").read_text(encoding="utf-8")
    text += (CATALOG / "catalog.go").read_text(encoding="utf-8")
    return set(re.findall(r'Slug:\s+"([^"]+)"', text))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    icons: dict[str, bool] = {}
    before = 0
    after = 0
    sources = sorted(SRC.glob("*.svg")) if SRC.exists() else []
    existing = {path.name for path in OUT.glob("*.svg")}
    for path in sources:
        if path.name in existing:
            continue
        raw = path.read_text(encoding="utf-8")
        before += len(raw.encode())
        small = minify(raw)
        after += len(small.encode())
        (OUT / path.name).write_text(small, encoding="utf-8")
    for path in sorted(OUT.glob("*.svg")):
        icons[path.stem] = is_white(path.read_text(encoding="utf-8"))

    lookup: dict[str, str] = {}
    for slug in sorted(catalog_slugs()):
        if slug in icons:
            lookup[slug] = slug
            continue
        alias = ALIASES.get(slug)
        if alias and alias in icons:
            lookup[slug] = alias
            continue
        head = slug.split("-", 1)[0]
        if head in icons:
            lookup[slug] = head

    lines = [
        "export type ProviderIcon = { file: string; white: boolean }",
        "",
        "const icons: Record<string, ProviderIcon> = {",
    ]
    for stem, white in icons.items():
        flag = "true" if white else "false"
        lines.append(f"  {json_key(stem)}: {{ file: {quote(stem)}, white: {flag} }},")
    lines.append("}")
    lines.append("")
    lines.append("const aliases: Record<string, string> = {")
    for slug, stem in lookup.items():
        if slug == stem:
            continue
        lines.append(f"  {json_key(slug)}: {quote(stem)},")
    lines.append("}")
    lines.append("")
    lines.append("export function providerIcon(slug: string): ProviderIcon | null {")
    lines.append("  const file = aliases[slug] ?? slug")
    lines.append("  return icons[file] ?? null")
    lines.append("}")
    lines.append("")
    TS.write_text("\n".join(lines), encoding="utf-8")
    print(f"icons {len(icons)} bytes {before} -> {after} matched {len(lookup)}")


def quote(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def json_key(value: str) -> str:
    if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", value):
        return value
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


if __name__ == "__main__":
    main()
