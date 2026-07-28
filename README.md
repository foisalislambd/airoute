# AIRoute

> 🚧 **Under construction** — this project is actively being built and restructured. APIs, docs, and behavior may change without notice.

**Your local AI gateway** — one OpenAI-compatible endpoint that routes across many providers, accounts, and models with smart fallback, quota awareness, and a full dashboard.

Point Cursor, Claude Code, Codex, OpenCode, Continue, or any OpenAI SDK client at AIRoute. Connect free tiers, OAuth apps, and API keys once. AIRoute handles translation, failover, rate limits, and usage tracking for you.

```bash
npm install
npm run dev
# → http://localhost:20128
```

---

## Why AIRoute?

| Pain without a gateway | With AIRoute |
| --- | --- |
| Every tool needs its own keys & endpoints | One base URL + one API key for all tools |
| Provider goes down → your agent dies | Combos fall through accounts/models automatically |
| Free quotas burn out mid-session | Quota-aware routing, cooldowns, reset-window strategies |
| Claude / Gemini / OpenAI APIs differ | Request & response translation on the fly |
| No visibility into spend or failures | Dashboard: usage, health, costs, circuit breakers |

**Benefits in practice**

- **Save money** — prefer free/cheap models first; fall back only when needed
- **Stay online** — multi-account + multi-provider combos survive outages and 429s
- **Ship faster** — drop-in OpenAI `/v1` API; no client rewrites
- **Stay private** — runs on your machine; SQLite data under `~/.airoute`
- **Stay in control** — API keys, scopes, IP filters, LOCAL_ONLY management routes

---

## What it does

```
  IDE / CLI / SDK                 AIRoute                         Upstream
 ─────────────────         ─────────────────────           ─────────────────
  Cursor / Claude Code  →   Auth + rate limits        →    Claude / Codex
  OpenCode / Continue   →   Translate formats         →    Gemini / OpenAI
  curl / custom agents  →   Combo routing + fallback  →    Free providers
                            Quota / cooldown / health      Groq / OpenRouter…
                            Usage & cost tracking
```

### Core capabilities

- **OpenAI-compatible API** — `/v1/chat/completions`, `/v1/responses`, `/v1/models`, embeddings, images, audio, search, and more
- **Combos** — chain providers/models/accounts with strategies like priority, round-robin, P2C, cost-optimized, reset-aware, auto, fusion
- **Auto routing** — prefixes like `auto/coding`, `auto/fast`, `auto/cheap` pick a fit without hand-tuning
- **Provider hub** — OAuth (Claude, Codex, Cursor, Kiro, …) + API keys + free providers
- **Resilience** — circuit breakers, cooldowns, model lockout, account fallback, sticky sessions
- **Compression & context** — prompt compression pipelines, context handoff between accounts
- **Ops dashboard** — providers, combos, analytics, health, translator playground, API keys
- **MCP / skills / memory** — optional agent tooling on top of the gateway

---

## Quick start

### Requirements

- Node.js **22.22+** or **24–26** (see `package.json` `engines`)
- npm workspaces (this repo)

### Run from source

```bash
git clone https://github.com/foisalislambd/airoute.git
cd airoute
npm install
npm run dev
```

Open **http://localhost:20128**

1. Add a provider (free or OAuth / API key)
2. Create an API key in the dashboard
3. Point your tool at AIRoute:

```bash
export OPENAI_BASE_URL=http://localhost:20128/v1
export OPENAI_API_KEY=your-airoute-key

curl http://localhost:20128/v1/models \
  -H "Authorization: Bearer your-airoute-key"
```

### Data & config

| Item | Default |
| --- | --- |
| Dashboard / API | `http://localhost:20128` |
| Data directory | `~/.airoute` (override with `DATA_DIR`) |
| Secrets / `.env` | repo root `.env` |

---

## How it works

```
packages/
  web/        Next.js dashboard + HTTP API surface
  open-sse/   Streaming engine, executors, translators, combo router
  core/       SQLite, authz, domain, shared libs

bin/          CLI entry
config/       Shared config (e.g. i18n)
docs/         Product documentation
scripts/      Dev / build / ops helpers
```

**Request path (simplified)**

1. Client hits `/v1/...` with your AIRoute API key
2. Authz classifies the route and enforces scopes / locality
3. Model or combo is resolved (alias → combo → targets)
4. Request is translated to the upstream format
5. Executor calls the provider; failures trigger the next target
6. Response is translated back; usage is recorded

For deeper docs see [`docs/`](docs/README.md) — start with [Quick Start](docs/getting-started/QUICK-START.md) and [Architecture](docs/architecture/ARCHITECTURE.md).

---

## Common workflows

**IDE coding agent**
Set base URL to `http://localhost:20128/v1` and use an AIRoute API key. Use a combo model name (or `auto/coding`) so failover is automatic.

**Cheap daily use**
Connect free providers first; build a combo with cost-optimized / fill-first strategy; keep a paid account as last resort.

**Quota rotation**
Add multiple accounts for the same provider; use reset-aware or quota-share strategies so traffic spreads across windows.

**Debugging**
Use the Translator playground and Live Monitor in the dashboard to inspect format conversion and streams.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Next.js app (dashboard + API) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Lint the web package |

CLI tooling lives under `bin/` (e.g. `bin/airoute.mjs` → serve, doctor, provider setup).

---

## Security notes

- Management routes that can spawn processes are **LOCAL_ONLY** (loopback / trusted LAN with stamped peer IP)
- Provider credentials can be encrypted at rest (`STORAGE_ENCRYPTION_KEY`)
- Prefer binding to localhost unless you intentionally expose the gateway

See [SECURITY.md](SECURITY.md) for reporting and architecture details.

---

## Project layout

See [STRUCTURE.md](STRUCTURE.md) for the monorepo map and layout rules.

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md).

- Bugs & features: [GitHub Issues](https://github.com/foisalislambd/airoute/issues)
- Support: [SUPPORT.md](SUPPORT.md)
- Security: [SECURITY.md](SECURITY.md)
- Changelog: [CHANGELOG.md](CHANGELOG.md)

---

## License

[MIT](LICENSE) © 2026 [foisalislambd](https://github.com/foisalislambd)
