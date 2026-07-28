---
title: "CLI Integrations — point any coding CLI at AIRoute"
version: 3.8.40
lastUpdated: 2026-06-28
---

# CLI Integrations

AIRoute ships a family of `setup-*` commands that configure a coding
CLI (Codex, Claude Code, OpenCode, Cline, …) to use AIRoute as its backend — so
the tool talks to **one** endpoint and AIRoute routes to the right provider with
auto-fallback. Each command reads the **live** model catalog from a running
AIRoute (local or remote) and writes the tool's own config file on **your**
machine. The API key is referenced by an environment variable wherever the tool
supports it. Commands that persist a tool-local environment file are noted below.

There are also two launchers — `airoute launch` (Claude Code) and
`airoute launch-codex` (Codex) — that spawn the CLI with the right env injected,
without writing any config at all.

For the one-time, hand-written base setup of the two richest integrations, see the
per-tool deep dives:

- [Claude Code configuration](./CLAUDE-CODE-CONFIGURATION.md)
- [Codex CLI configuration](./CODEX-CLI-CONFIGURATION.md)
- [Remote Mode](./REMOTE-MODE.md) — drive a remote AIRoute (VPS / Tailnet) from your laptop

---

## Master table

Every command honours the **active context** (set with `airoute connect`, see
[Remote Mode](./REMOTE-MODE.md)) or explicit `--remote <url> --api-key <key>` flags.
"Local vs remote" below means: with no flags it targets `http://localhost:20128`;
with `--remote` (or an active remote context) it fetches the catalog from that
server and writes the config locally.

| Command | Tool | What it writes | Key flags | Local vs remote |
|---------|------|----------------|-----------|-----------------|
| `airoute setup-codex` | OpenAI Codex CLI | `~/.codex/<name>.config.toml` — one profile per compatible text model (`codex --profile <name>`) | `--remote` `--api-key` `--only` `--dry-run` `--port` `--codex-home` | Both |
| `airoute setup-claude` | Claude Code | `~/.claude/profiles/<name>/settings.json` — one profile per matched model (`CLAUDE_CONFIG_DIR`) | `--remote` `--api-key` `--only` `--dry-run` `--port` `--claude-home` | Both |
| `airoute setup-opencode` | OpenCode (openai-compatible) | `~/.config/opencode/opencode.json` — `airoute` provider with every catalog model (`opencode -m airoute/<model>`) | `--remote` `--api-key` `--only` `--model` `--dry-run` `--port` | Both |
| `airoute setup-cline` | Cline | `~/.cline/data/{globalState,secrets}.json` (CLI mode) + prints VS Code extension settings | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--cline-dir` | Both |
| `airoute setup-kilo` | Kilo Code | `~/.local/share/kilo/auth.json` (CLI) + merges `kilocode.*` into VS Code `settings.json` if present | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--auth-path` `--vscode-settings` | Both |
| `airoute setup-continue` | Continue / `cn` CLI | `~/.continue/config.yaml` — `provider: openai` models, key via `${{ secrets.AIROUTE_API_KEY }}` | `--remote` `--api-key` `--only` `--dry-run` `--port` `--config-path` | Both |
| `airoute setup-cursor` | Cursor | Nothing — prints the in-app steps (Cursor config is opaque SQLite) | `--remote` `--api-key` `--only` `--port` | Both |
| `airoute setup-roo` | Roo Code | `~/.airoute/roo-settings.json` (import doc) + sets `roo-cline.autoImportSettingsPath` if a VS Code `settings.json` exists | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--import-path` `--vscode-settings` | Both |
| `airoute setup-crush` | Crush | `~/.config/crush/crush.json` — `openai-compat` provider, key via `$AIROUTE_API_KEY` | `--remote` `--api-key` `--only` `--dry-run` `--port` `--config-path` | Both |
| `airoute setup-goose` | Goose | `~/.config/goose/config.yaml` (`GOOSE_PROVIDER`/`OPENAI_HOST`/`GOOSE_MODEL`) + prints env recipe | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--config-path` | Both |
| `airoute setup-aider` | Aider | `~/.aider.conf.yml` (`openai-api-base` + `model: openai/<id>`) + prints env recipe | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--config-path` | Both |
| `airoute setup-qwen` | Qwen Code | `~/.qwen/settings.json` — V4 `modelProviders.openai` array + `AIROUTE_API_KEY` in `~/.qwen/.env` | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--config-path` `--env-path` | Both |
| `airoute launch` | Claude Code | Nothing — spawns `claude` with `ANTHROPIC_BASE_URL`/`ANTHROPIC_AUTH_TOKEN` injected | `--remote` `--api-key` `--token` `--profile` `--port` | Both |
| `airoute launch-codex` | OpenAI Codex CLI | Nothing — spawns `codex` with the `airoute` provider injected via `-c` flags | `--remote` `--api-key` `--profile` (`-p`) `--port` | Both |

Notes on flags (verified in the command source):

- `--remote <url>` — fetch the catalog from a remote AIRoute (overrides `--port`
  and the active context). `--api-key <key>` supplies the credential for that
  server (defaults to the `AIROUTE_API_KEY` env var, or the active context's token).
- `--only <patterns>` — comma-separated substrings; keep only model IDs that match
  (e.g. `--only glm,kimi`). Available on `setup-codex`, `setup-claude`,
  `setup-opencode`, `setup-continue`, `setup-cursor`, `setup-crush`.
- `--dry-run` — print exactly what would be written without touching the
  filesystem. Available on every `setup-*` command **except** `setup-cursor`
  (which never writes a file).
- `--model <id>` — required (or picked interactively) for the tools that have no
  model auto-discovery: Cline, Kilo, Roo, Goose, Qwen, Aider. Those tools
  also accept `--yes` for non-interactive runs (which then requires `--model`).
  `setup-opencode` takes `--model` to set the default top-level model.
- `--port <port>` — local AIRoute port (default `20128`, ignored when `--remote`
  is set). Present on all `setup-*` and both launchers.
- The two launchers (`launch`, `launch-codex`) accept `--profile <name>` to select
  a profile written by `setup-claude` / `setup-codex`, plus pass-through args for
  the underlying `claude` / `codex` binary.

> `setup-opencode` is the **lightweight openai-compatible** OpenCode integration.
> There is also a richer plugin integration — `airoute setup opencode` — which
> installs `@omniroute/opencode-plugin`. They are different commands; the table
> above documents `setup-opencode`.

---

## Local usage

With AIRoute running on `localhost:20128`, just run the setup command for your
tool. The catalog is fetched from the local server.

```bash
# Codex: write a profile per matched model into ~/.codex/
airoute setup-codex
codex --profile glm52            # use a generated profile

# Claude Code: write per-model profiles, then launch one
airoute setup-claude
airoute launch --profile glm52

# OpenCode: write the openai-compatible provider with all catalog models
airoute setup-opencode
export AIROUTE_API_KEY=sk-...  # referenced via {env:AIROUTE_API_KEY}, never on disk
opencode -m airoute/glm/glm-5.2 "..."

# Tools without auto-discovery need an explicit model:
airoute setup-aider --model glm/glm-5.2
airoute setup-qwen --model qwen/qwen3.8-max-preview

# Preview without writing anything:
airoute setup-continue --dry-run
```

Launch without writing any config at all (env-injection only):

```bash
airoute launch                 # Claude Code → local AIRoute
airoute launch-codex           # Codex CLI → local AIRoute
airoute launch-codex --profile glm52
```

---

## Remote usage

Point any setup command at a remote AIRoute with `--remote` + `--api-key`. The
catalog is fetched from the remote; the config is written on your local machine.

```bash
# OpenCode against a remote VPS, keep only glm/kimi models
airoute setup-opencode --remote http://192.168.0.15:20128 --api-key oma_live_xxx \
  --only glm,kimi
opencode -m airoute/glm/glm-5.2 "..."   # export AIROUTE_API_KEY first

# Codex profiles from a remote catalog
airoute setup-codex --remote http://192.168.0.15:20128 --api-key oma_live_xxx

# Launch a CLI straight against the remote
airoute launch       --remote http://192.168.0.15:20128 --api-key oma_live_xxx
airoute launch-codex --remote http://192.168.0.15:20128 --api-key oma_live_xxx
```

Instead of passing `--remote`/`--api-key` every time, log in once and let the
**active context** supply them automatically:

```bash
airoute connect 192.168.0.15        # mints a scoped token, stores the context
airoute setup-codex                 # ← now uses the remote catalog
airoute setup-opencode              # ← same
airoute launch                      # ← Claude Code against the remote
```

See [Remote Mode](./REMOTE-MODE.md) for contexts, scopes, and token management.

---

## Base URL conventions (which tools want `/v1`)

AIRoute exposes the OpenAI surface at `/v1`, the Anthropic surface at the root,
and a native Gemini surface at `/v1beta`. Each integration is wired to the form its
tool expects (verified in the command source):

| Integration | Base URL written | `/v1`? |
|-------------|------------------|--------|
| `setup-cline` (`openAiBaseUrl`) | root | No — Cline appends `/v1/chat/completions` |
| `setup-goose` (`OPENAI_HOST`) | root | No — Goose appends the path |
| `setup-aider` (`OPENAI_API_BASE`) | root | No — LiteLLM appends `/v1/chat/completions` |
| `setup-kilo`, `setup-roo`, `setup-continue`, `setup-crush`, `setup-cursor` | with `/v1` | Yes |
| `setup-claude` (`ANTHROPIC_BASE_URL`), `launch` | root | No — Claude Code appends `/v1/messages` |
| `setup-codex`, `launch-codex` (`model_providers.airoute.base_url`) | with `/v1` | Yes |
| `setup-qwen` (`modelProviders.openai[].baseUrl`) | with `/v1` | Yes |

---

## Keeping native deps on update: `--include=optional`

When you update with `airoute update` (after confirming, or with `--apply`),
AIRoute runs the install with `--include=optional` baked in:

```bash
npm install -g airoute@latest --include=optional
```

This is **not** a flag you pass to `airoute update` — it is always applied by the
updater. It guarantees the `optionalDependencies` (`better-sqlite3`, `keytar`,
`tls-client`, the LLMLingua SLM stack) survive the update even if your npm config
has `omit=optional` set, which would otherwise silently drop the native SQLite
driver and OS-keyring binding. To preview the exact command without applying:

```bash
airoute update --dry-run
# [DRY RUN] Would run: npm install -g airoute@latest --include=optional
```

Other `airoute update` flags (verified in source): `--check` (exit 1 if
outdated), `--apply` (install without prompting), `--changelog`, `--no-backup`,
`--yes`.

---

## See also

- [Claude Code configuration](./CLAUDE-CODE-CONFIGURATION.md) — the deeper Claude Code guide
- [Codex CLI configuration](./CODEX-CLI-CONFIGURATION.md) — the one-time `[model_providers.airoute]` base setup
- [Remote Mode](./REMOTE-MODE.md) — contexts, scoped access tokens, driving a remote server
- [CLI Tools reference](../reference/CLI-TOOLS.md) — the full catalog of supported tools + dashboard pages
- [Setup Guide](./SETUP_GUIDE.md) — install methods and first-run onboarding
