# Publish AIRoute to npm

See **[PUBLISH.md](./PUBLISH.md)** for the full 4-registry guide (npmjs, GitHub Packages, Docker Hub, GHCR).

AIRoute publishes as a **CLI + standalone Next.js runtime**, not as an importable library.

## One-time setup

1. Create an npm account and verify you can publish the name `airoute`.
2. Add GitHub secret `NPM_TOKEN` (Automation token).
3. Login locally (optional for manual publish):

```bash
npm login
npm whoami
```

## Local release checklist

```bash
npm version patch
npm run build:release
npm run check:pack-artifact
npm publish --access public
```

Or cut a GitHub Release and let `.github/workflows/npm-publish.yml` publish to **npmjs + GitHub Packages**.

## Useful scripts

| Script | Purpose |
| --- | --- |
| `npm run build` | Next standalone via `build-next-isolated.mjs` |
| `npm run build:cli` | Assemble `dist/` for the npm package |
| `npm run build:release` | Clean + build + CLI + build SHA |
| `npm run check:pack-artifact` | `npm pack --dry-run` policy gate |
| `npm run check:pack-policy` | Policy helpers only (no build) |

Skip postinstall with `AIROUTE_SKIP_POSTINSTALL=1` (or `CI=1`).
