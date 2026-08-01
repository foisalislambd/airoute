# AIRoute structure

```
airoute/
├── packages/
│   ├── web/       # Next.js UI + API (@airoute/web)
│   ├── open-sse/  # streaming / routing engine
│   └── core/      # db, shared, domain (@airoute/core)
├── bin/           # CLI
├── config/        # shared JSON/config (e.g. i18n.json)
├── docs/          # product docs
├── scripts/       # build / dev / ops scripts
├── skills/        # agent skills
├── .source/       # fumadocs generated modules
├── docker/        # Dockerfile + compose
└── package.json   # npm workspaces root
```

**Brand:** AIRoute · **Data dir:** `~/.airoute` (override with `DATA_DIR`) · **npm:** `npm i -g airoute`

## Layout rules

- `packages/` holds only real packages (`web`, `open-sse`, `core`) — no symlinks to root folders.
- Next entrypoints under `packages/web/src/` (`instrumentation.ts`, `proxy.ts`) are thin re-exports of `packages/core`.
- Path aliases: `@/*` → `packages/core`, open-sse package → `packages/open-sse`.
- Root `.env` is loaded by `packages/web/next.config.mjs` (no `packages/web/.env` symlink).
