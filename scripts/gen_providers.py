"""Generate apps/server/internal/catalog/catalog_generated.go from the local provider list.

Run from the repo root: python scripts/gen_providers.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "docs" / "all-llm-provider-list" / "data"
OUT = ROOT / "apps" / "server" / "internal" / "catalog" / "catalog_generated.go"

URL_FIXES = {
    "google-ai-studio": "https://generativelanguage.googleapis.com/v1beta/openai",
    "auggie": "auggie://cli/stdio",
    "devin-cli-agentic": "devin://acp/stdio",
    "zcode": "zcode://app-server/stdio",
    "codex-app-server": "codex-app-server://cli/websocket",
    "mlx-gemma": "http://127.0.0.1:11435/v1",
    "mlx-qwen": "http://127.0.0.1:11436/v1",
}

VIDEO_PARTS = (
    "sora",
    "veo",
    "kling",
    "runway",
    "luma",
    "hailuo",
    "cogvideo",
    "mochi",
    "i2v",
    "t2v",
    "r2v",
    "video",
    "wan-",
    "wan/",
    "seedance",
)
IMAGE_PARTS = (
    "dall-e",
    "gpt-image",
    "flux",
    "stable-diffusion",
    "imagen",
    "sdxl",
    "ideogram",
    "recraft",
    "kandinsky",
    "kolors",
    "playground-v",
    "midjourney",
    "hidream",
    "qwen-image",
    "nano-banana",
)
AUDIO_PARTS = ("whisper", "tts", "transcri", "audio", "speech", "eleven")
EMBED_PARTS = ("embedding", "embed-", "rerank", "moderation")


def usable_url(slug: str, raw: str) -> str:
    if slug in URL_FIXES:
        return URL_FIXES[slug]
    raw = (raw or "").strip().rstrip("/")
    for suffix in ("/chat/completions", "/chat-completions", "/chat"):
        if raw.endswith(suffix):
            raw = raw[: -len(suffix)].rstrip("/")
    if not raw or "${" in raw or "{" in raw or "}" in raw:
        return ""
    parsed = urlparse(raw)
    host = parsed.hostname or ""
    if parsed.scheme == "https" and host:
        return raw
    if parsed.scheme == "http" and host in {"localhost", "127.0.0.1"}:
        return raw
    return ""


def protocol_name(provider: dict, base: str) -> str:
    lowered = base.lower()
    slug = provider.get("slug") or ""
    notes = (provider.get("notes") or "").lower()
    raw_url = (provider.get("api_base_url") or "").lower()
    category = provider.get("category") or ""
    # These slugs are browser, websocket, or CLI sessions. They are not chat-completions APIs.
    if slug in {
        "duckduckgo-web",
        "cloudflare-playground",
        "chipotle",
        "lmarena",
        "notion-web",
        "promptql",
        "hyperagent",
        "conol-web",
    }:
        return "ProtocolUnsupported"
    # Wafer's published route is Anthropic messages, not chat completions.
    if slug == "wafer":
        return "ProtocolAnthropic"
    if slug in {"anthropic", "claude", "claude-code"} or "api.anthropic.com" in lowered or "/anthropic" in lowered:
        return "ProtocolAnthropic"
    if "generativelanguage.googleapis.com" in lowered and "/openai" not in lowered:
        return "ProtocolGemini"
    if "aiplatform.googleapis.com" in lowered:
        return "ProtocolGemini"
    if slug in {"ollama-cloud", "ollama"} or lowered.rstrip("/").endswith("ollama.com/api"):
        return "ProtocolOllama"
    if slug == "cohere" or "api.cohere.com" in lowered:
        return "ProtocolCohere"
    if category == "Search" or slug in {"firecrawl", "context7", "jina-reader", "tinyfish"}:
        return "ProtocolSearch"
    if category == "Embeddings":
        return "ProtocolEmbedding"
    if category == "Audio":
        return "ProtocolAudio"
    if slug == "sdwebui":
        return "ProtocolSDWebUI"
    if category == "Image / Video" and not provider.get("openai_compatible"):
        return "ProtocolMedia"
    openai_note = "openai-compatible" in notes or "openai compatible" in notes or "chat/completions" in notes or "chat/completions" in raw_url
    if provider.get("openai_compatible") or openai_note or raw_url.rstrip("/").endswith("/v1"):
        return "ProtocolOpenAIChat"
    return "ProtocolUnsupported"


def model_kind(model_id: str, category: str) -> str:
    lowered = model_id.lower()
    if any(part in lowered for part in VIDEO_PARTS):
        return "KindVideo"
    if any(part in lowered for part in IMAGE_PARTS):
        return "KindImage"
    if any(part in lowered for part in AUDIO_PARTS):
        return "KindAudio"
    if any(part in lowered for part in EMBED_PARTS):
        return "KindEmbedding"
    if category == "Image / Video":
        if any(part in lowered for part in ("video", "sora", "veo", "runway", "luma")):
            return "KindVideo"
        return "KindImage"
    if category == "Audio":
        return "KindAudio"
    if category == "Embeddings":
        return "KindEmbedding"
    if category == "Search":
        return "KindSearch"
    return "KindChat"


def model_ids(provider: dict, entry: dict) -> list[str]:
    raw = entry.get("models") or provider.get("popular_models") or []
    kept: list[str] = []
    seen: set[str] = set()
    for model_id in raw:
        model_id = str(model_id).strip()
        if not model_id or " " in model_id or model_id.startswith("$"):
            continue
        if model_id in seen:
            continue
        seen.add(model_id)
        kept.append(model_id)
    return kept


def is_free(provider: dict) -> bool:
    text = " ".join(str(provider.get(key) or "") for key in ("name", "slug", "notes"))
    return re.search(r"\bfree\b", text, re.I) is not None


KEYLESS = {
    "devin-cli-agentic",
    "opencode",
    "duckduckgo-web",
    "cloudflare-playground",
    "veoaifree-web",
    "auggie",
    "zcode",
    "codex-app-server",
    "uncloseai",
    "aihorde",
    "chipotle",
    "searxng-search",
    "context7",
    "sdwebui",
    "comfyui",
}

ANONYMOUS_KEYS = {
    "aihorde": "0000000000",
    "uncloseai": "anonymous",
}


def key_optional(provider: dict) -> bool:
    return provider.get("category") == "No-auth" or provider.get("slug") in KEYLESS


def anonymous_key(slug: str) -> str:
    return ANONYMOUS_KEYS.get(slug, "")


def default_models(provider: dict, protocol: str, category: str) -> list[str]:
    slug = provider.get("slug") or ""
    notes = (provider.get("notes") or "").lower()
    if protocol == "ProtocolSearch":
        return ["search"]
    if protocol == "ProtocolEmbedding":
        return ["embed"]
    if protocol == "ProtocolAudio":
        return ["speech"]
    if protocol in {"ProtocolMedia", "ProtocolSDWebUI"}:
        if slug in {"runwayml", "luma"} or "video" in notes:
            return ["video"]
        return ["image"]
    if protocol == "ProtocolCohere":
        return ["command-a-03-2025"]
    return []


def go_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def summary_for(provider: dict, protocol: str) -> str:
    notes = (provider.get("notes") or "").strip()
    if notes:
        return notes
    if protocol == "ProtocolOpenAIChat":
        return "OpenAI-compatible API."
    if protocol == "ProtocolAnthropic":
        return "Anthropic Messages API."
    if protocol == "ProtocolGemini":
        return "Gemini generateContent API."
    if protocol == "ProtocolOllama":
        return "Ollama chat API."
    if protocol == "ProtocolCohere":
        return "Cohere v2 chat API."
    if protocol == "ProtocolSearch":
        return "Search API. The playground sends your prompt as the query."
    if protocol == "ProtocolEmbedding":
        return "Embedding API. The playground sends your prompt as the input."
    if protocol == "ProtocolAudio":
        return "Speech API. The playground sends your prompt as the text to speak."
    if protocol == "ProtocolMedia":
        return "Image or video API."
    if protocol == "ProtocolSDWebUI":
        return "Local Stable Diffusion WebUI. No key required. Set the base URL if it is not the default."
    return "This provider needs a browser session, OAuth login, or account-specific credentials this router does not store."


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
    kinds = {"KindChat": 0, "KindImage": 0, "KindVideo": 0, "KindAudio": 0, "KindEmbedding": 0, "KindSearch": 0}
    protocols: dict[str, int] = {}
    for provider in providers:
        if provider.get("slug") == "openai":
            continue
        base = usable_url(provider["slug"], provider.get("api_base_url") or "")
        protocol = protocol_name(provider, base)
        entry = models_db.get(provider["slug"], {})
        ids = model_ids(provider, entry)
        category = provider.get("category") or "Other"
        website = (provider.get("website") or "").strip()
        lines.append("\t\t{")
        lines.append(f"\t\t\tSlug: {go_string(provider['slug'])},")
        lines.append(f"\t\t\tDisplayName: {go_string(provider['name'])},")
        lines.append(f"\t\t\tProtocol: {protocol},")
        lines.append(f"\t\t\tDefaultBaseURL: {go_string(base)},")
        lines.append(f"\t\t\tDocsURL: {go_string(website)},")
        lines.append(f"\t\t\tSummary: {go_string(summary_for(provider, protocol))},")
        lines.append(f"\t\t\tCategory: {go_string(category)},")
        if is_free(provider):
            lines.append("\t\t\tFree: true,")
        if key_optional(provider):
            lines.append("\t\t\tKeyOptional: true,")
        if anon := anonymous_key(provider["slug"]):
            lines.append(f"\t\t\tAnonymousKey: {go_string(anon)},")
        if not ids:
            ids = default_models(provider, protocol, category)
        lines.append("\t\t\tModels: []Model{")
        for model_id in ids:
            kind = model_kind(model_id, category)
            kinds[kind] += 1
            label = {
                "KindImage": "Image model",
                "KindVideo": "Video model",
                "KindAudio": "Audio model",
                "KindEmbedding": "Embedding model",
                "KindSearch": "Search",
            }.get(kind, provider["name"] + " model")
            lines.append("\t\t\t\t{")
            lines.append(f"\t\t\t\t\tUpstreamID: {go_string(model_id)},")
            lines.append(f"\t\t\t\t\tDisplayName: {go_string(model_id)},")
            lines.append(f"\t\t\t\t\tDescription: {go_string(label)},")
            lines.append(f"\t\t\t\t\tKind: {kind},")
            lines.append("\t\t\t\t},")
            model_count += 1
        lines.append("\t\t\t},")
        lines.append("\t\t},")
        count += 1
        protocols[protocol] = protocols.get(protocol, 0) + 1
    lines.append("\t}")
    lines.append("}")
    lines.append("")
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {count} providers, {model_count} models")
    print("protocols", protocols)
    print("kinds", kinds)


if __name__ == "__main__":
    main()
