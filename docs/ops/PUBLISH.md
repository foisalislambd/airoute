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

## Auto-release on `main` (default)

Every push to **`main`** runs **Release**:

1. Bump version (`package.json` + workspaces)
2. Commit `chore(release): X.Y.Z` (includes `[skip release]` so it does not loop)
3. Create tag **`vX.Y.Z`** + **GitHub Release**
4. Dispatch **npm** + **Docker** publish (all 4 registries)

First release (no `v*` tags yet) → **`1.0.0`**.

### Skip a release

Put one of these in the commit message (any line):

- `[skip release]`
- `[no release]`

Example:

```bash
git commit -m "docs: tweak README

[skip release]"
```

Pure `**.md` / `docs/**` pushes are also ignored (no version bump).

### Manual release

GitHub → **Actions** → **Release** → **Run workflow**

- `mode: auto` (default) — next version
- `mode: current` — tag whatever is in `package.json`
- `mode: explicit` — set `version` (e.g. `1.2.0`)

## Required GitHub secrets

| Secret | Used by |
| --- | --- |
| `NPM_TOKEN` | npmjs publish |
| `DOCKERHUB_USERNAME` | Docker Hub login |
| `DOCKERHUB_TOKEN` | Docker Hub login |

`GITHUB_TOKEN` is automatic (GitHub Packages npm + GHCR + Release).

## Workflows

| Workflow | Role |
| --- | --- |
| `release.yml` | Auto on `main` (+ manual): bump + tag + GitHub Release + **dispatch** npm/Docker |
| `npm-publish.yml` | npmjs + GitHub Packages (`workflow_dispatch` only) |
| `docker-publish.yml` | Docker Hub + GHCR (`workflow_dispatch` only) |

Publish jobs are **not** hooked to `push`/`release` events. Release always dispatches them so each version publishes exactly once.

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
