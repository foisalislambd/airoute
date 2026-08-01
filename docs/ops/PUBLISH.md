# Publish AIRoute (npm + Docker)

Package / image name: **`airoute`**

| Target | Name |
| --- | --- |
| npmjs.org | `airoute` |
| GitHub Packages (npm) | `@foisalislambd/airoute` |
| Docker Hub | `foisalislambd/airoute` |
| GHCR | `ghcr.io/foisalislambd/airoute` |

## Version scheme

Starts at **`1.0.0`**. Patch rolls at 9, then minor, then major:

```
1.0.0 → 1.0.1 → … → 1.0.9 → 1.1.0 → … → 1.9.9 → 2.0.0 → …
```

## One-click release (recommended)

1. Add secrets: `NPM_TOKEN`, `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`
2. GitHub → **Actions** → **Release** → **Run workflow**
   - `mode: auto` (default) — picks next version
   - first run (no `v*` tags yet) → **`1.0.0`**
3. The workflow will:
   - bump `package.json` (+ workspaces)
   - commit `chore(release): X.Y.Z`
   - create tag **`vX.Y.Z`**
   - create **GitHub Release**
   - dispatch **npm** + **Docker** publish (all 4 registries)

## Required GitHub secrets

| Secret | Used by |
| --- | --- |
| `NPM_TOKEN` | npmjs publish |
| `DOCKERHUB_USERNAME` | Docker Hub login + image namespace |
| `DOCKERHUB_TOKEN` | Docker Hub login |

`GITHUB_TOKEN` is automatic (GitHub Packages npm + GHCR + Release).

## Workflows

| Workflow | Role |
| --- | --- |
| `release.yml` | Version bump + tag + GitHub Release + **dispatch** npm/Docker |
| `npm-publish.yml` | npmjs + GitHub Packages (`workflow_dispatch` only) |
| `docker-publish.yml` | Docker Hub + GHCR (`workflow_dispatch` + push `main`/`v*`) |

Publish jobs are **not** hooked to the `release` event (GITHUB_TOKEN-created releases do not re-trigger workflows). The Release workflow always dispatches them explicitly so each version publishes exactly once.

## Install / pull

```bash
npm install -g airoute

docker pull foisalislambd/airoute:latest
docker run --rm -p 20128:20128 -v airoute-data:/app/data foisalislambd/airoute:latest

docker pull ghcr.io/foisalislambd/airoute:latest
```

Web-cookie providers need the `-web` image:

```bash
docker pull foisalislambd/airoute:latest-web
```

## Local helpers

```bash
node scripts/release/next-version.mjs next 1.0.9    # → 1.1.0
node scripts/release/bump-version.mjs 1.1.0
docker build --target runner-base -t airoute:local .
docker compose --profile base up -d --build
```
