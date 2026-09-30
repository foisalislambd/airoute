"""Generate catalog_generated.go from the local provider list. Not part of the app runtime."""

from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[4]
DATA = ROOT / "docs" / "all-llm-provider-list" / "data"
OUT = Path(__file__).resolve().parent / "catalog_generated.go"

SKIP_CATEGORIES = {"Web Cookie", "Image / Video"}
# The list marks these as OpenAI-compatible, but the published base URL is the native API.
URL_FIXES = {
    "google-ai-studio": "https://generativelanguage.googleapis.com/v1beta/openai",
}

SKIP_MODEL_PARTS = (
    "whisper",
    "tts",
    "dall-e",
    "embedding",
    "embed-",
    "rerank",
    "moderation",
    "flux",
    "stable-diffusion",
    "imagen",
    "transcri",
    "audio",
)


def usable_url(slug: str, raw: str) -> str | None:
    raw = URL_FIXES.get(slug, raw or "").strip().rstrip("/")
    for suffix in ("/chat/completions", "/chat-completions"):
        if raw.endswith(suffix):
            raw = raw[: -len(suffix)].rstrip("/")
    if not raw or "${" in raw:
        return None
    parsed = urlparse(raw)
    host = parsed.hostname or ""
    if parsed.scheme == "https" and host:
        return raw
    if parsed.scheme == "http" and host in {"localhost", "127.0.0.1"}:
        return raw
    return None


def chat_models(ids: list[str]) -> list[str]:
    kept: list[str] = []
    seen: set[str] = set()
    for model_id in ids:
        model_id = model_id.strip()
        if not model_id or " " in model_id or model_id.startswith("$"):
            continue
        lowered = model_id.lower()
        if any(part in lowered for part in SKIP_MODEL_PARTS):
            continue
        if model_id in seen:
            continue
        seen.add(model_id)
        kept.append(model_id)
    return kept


def is_free(provider: dict) -> bool:
    text = " ".join(
        str(provider.get(key) or "") for key in ("name", "slug", "notes")
    )
    return re.search(r"\bfree\b", text, re.I) is not None


def go_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def main() -> None:
    providers = json.loads((DATA / "providers.json").read_text(encoding="utf-8"))
    models_db = json.loads((DATA / "models.json").read_text(encoding="utf-8"))["providers"]
    lines = [
        "package catalog",
        "",
        "// Generated from docs/all-llm-provider-list. OpenAI stays in catalog.go.",
        "func generatedProviders() []Provider {",
        "\treturn []Provider{",
    ]
    count = 0
    model_count = 0
    for provider in providers:
        if provider.get("slug") == "openai" or not provider.get("openai_compatible"):
            continue
        if provider.get("category") in SKIP_CATEGORIES:
            continue
        base = usable_url(provider["slug"], provider.get("api_base_url") or "")
        if base is None or "/anthropic" in base:
            continue
        entry = models_db.get(provider["slug"], {})
        model_ids = chat_models(entry.get("models") or provider.get("popular_models") or [])
        if not model_ids:
            continue
        website = (provider.get("website") or "").strip()
        notes = (provider.get("notes") or "").strip()
        summary = notes or "OpenAI-compatible chat API."
        lines.append("\t\t{")
        lines.append(f"\t\t\tSlug: {go_string(provider['slug'])},")
        lines.append(f"\t\t\tDisplayName: {go_string(provider['name'])},")
        lines.append("\t\t\tProtocol: ProtocolOpenAIChat,")
        lines.append(f"\t\t\tDefaultBaseURL: {go_string(base)},")
        lines.append(f"\t\t\tDocsURL: {go_string(website)},")
        lines.append(f"\t\t\tSummary: {go_string(summary)},")
        lines.append(f"\t\t\tCategory: {go_string(provider.get('category') or 'Other')},")
        if is_free(provider):
            lines.append("\t\t\tFree: true,")
        lines.append("\t\t\tModels: []Model{")
        for model_id in model_ids:
            lines.append("\t\t\t\t{")
            lines.append(f"\t\t\t\t\tUpstreamID: {go_string(model_id)},")
            lines.append(f"\t\t\t\t\tDisplayName: {go_string(model_id)},")
            lines.append(f"\t\t\t\t\tDescription: {go_string(provider['name'] + ' model')},")
            lines.append("\t\t\t\t},")
            model_count += 1
        lines.append("\t\t\t},")
        lines.append("\t\t},")
        count += 1
    lines.append("\t}")
    lines.append("}")
    lines.append("")
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {count} providers, {model_count} models")


if __name__ == "__main__":
    main()
