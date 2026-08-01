# Publish AIRoute

One workflow: **`.github/workflows/release.yml`**

| Registry | Name |
| --- | --- |
| npmjs | `airoute` |
| GitHub Packages | `@foisalislambd/airoute` |
| Docker Hub | `foisalislambd/airoute` |
| GHCR | `ghcr.io/foisalislambd/airoute` |

## Flow

Push to **`main`** → same workflow:

1. Bump version + tag `vX.Y.Z` + GitHub Release  
2. Publish **npm** `@X.Y.Z`  
3. Publish **Docker** `:X.Y.Z` (+ `-web`, `:latest`)  

## Skip

Commit message must include:

```
[skip release]
```

→ no tag, npm, or Docker.

## Secrets

`NPM_TOKEN`, `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`

## Manual

Actions → **Release** → Run workflow (optional version).
