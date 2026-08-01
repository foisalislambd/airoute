# Publish AIRoute

One workflow: **`.github/workflows/release.yml`**

| Registry | Name |
| --- | --- |
| npmjs | `airoute` |
| GitHub Packages | `@foisalislambd/airoute` |
| Docker Hub | `foisalislambd/airoute` |
| GHCR | `ghcr.io/foisalislambd/airoute` |

## Versioning (local — not CI)

Bump **before** push (humans or agents). See root **`AGENTS.md`**.

```bash
CURRENT=$(node -p "require('./package.json').version")
TAGS=$(git tag -l 'v[0-9]*' | tr '\n' ',')
NEXT=$(node scripts/release/next-version.mjs resolve "$CURRENT" "$TAGS")
node scripts/release/bump-version.mjs "$NEXT"
node scripts/release/stamp-changelog.mjs "$NEXT"
```

## Flow

Push to **`main`** (with a **new** `package.json` version that has no `v*` tag yet):

1. Tag `vX.Y.Z` + GitHub Release  
2. Publish **npm** `@X.Y.Z`  
3. Publish **Docker** `:X.Y.Z` (+ `-web`, `:latest`)  

If that version’s tag already exists → workflow skips publish.

## Skip

Commit message:

```
[skip release]
```

→ no tag, npm, or Docker.

## Secrets

`NPM_TOKEN`, `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`
