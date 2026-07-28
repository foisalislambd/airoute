# Contributing to AIRoute

Thanks for helping improve AIRoute. This project is under active construction —
small, focused changes are easier to review than large rewrites.

## Before you start

1. Read the [Code of Conduct](CODE_OF_CONDUCT.md).
2. Skim [STRUCTURE.md](STRUCTURE.md) and `docs/` for the area you want to touch.
3. Search [existing issues](https://github.com/foisalislambd/airoute/issues) and
   PRs to avoid duplicates.
4. For security bugs, follow [SECURITY.md](SECURITY.md) — do **not** open a
   public issue.

## Development setup

```bash
git clone https://github.com/foisalislambd/airoute.git
cd airoute
npm install
npm run dev
# → http://localhost:20128
```

Requirements: Node.js **22.22+** or **24–26** (see `package.json` `engines`).

Useful commands:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dashboard + API |
| `npm run build` | Production build |
| `npm run lint` | Lint `@airoute/web` |

Data lives under `~/.airoute` by default (`DATA_DIR` to override).

## Project layout

```
packages/web/       Next.js dashboard + HTTP API
packages/open-sse/  Streaming engine, executors, translators, combo router
packages/core/      SQLite, authz, domain, shared libs
bin/                CLI
docs/               Product documentation
```

Prefer edits in the real package paths above — avoid convenience symlinks or
duplicating docs trees.

## How to contribute

### Bugs

1. Open an issue with reproduction steps, expected vs actual behavior, and
   environment (OS, Node version, AIRoute commit).
2. Or fix it and open a PR referencing the issue.

### Features

Open an issue first for non-trivial features so scope can be agreed. Keep PRs
focused on one change.

### Docs

Docs live in `docs/` (English source). Fix typos, broken links, and outdated
commands freely — those PRs are always welcome.

## Pull request checklist

- [ ] Branch from `main` with a clear name (`fix/…`, `feat/…`, `docs/…`)
- [ ] Change is scoped; unrelated refactors left out
- [ ] `npm run lint` passes for touched web code
- [ ] Docs updated if behavior or setup changed
- [ ] No secrets, tokens, or local `.env` committed
- [ ] PR description explains **why**, not only what

### PR title style

Prefer conventional titles:

- `fix: …`
- `feat: …`
- `docs: …`
- `refactor: …`
- `chore: …`

## Code guidelines

- Match existing style in the file you edit (TypeScript / ESM).
- Prefer small helpers over large copy-paste.
- Do not weaken authz, LOCAL_ONLY guards, or secret-handling patterns.
- Provider credentials and public OAuth client ids must follow
  `docs/security/PUBLIC_CREDS.md` and `docs/security/ERROR_SANITIZATION.md`.

## Getting help

- Questions / usage: [GitHub Discussions](https://github.com/foisalislambd/airoute/discussions)
  (enable if available) or [Issues](https://github.com/foisalislambd/airoute/issues)
- Security: [SECURITY.md](SECURITY.md)

## License

By contributing, you agree that your contributions are licensed under the same
[MIT License](LICENSE) as the project.
