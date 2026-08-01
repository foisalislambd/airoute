# Publish AIRoute

One workflow: **`.github/workflows/release.yml`**

| Registry | Name |
| --- | --- |
| npmjs | `airoute` |
| GitHub Packages | `@foisalislambd/airoute` |
| Docker Hub | `foisalislambd/airoute` |
| GHCR | `ghcr.io/foisalislambd/airoute` |

## Versioning (agents / maintainers)

CI **never** bumps versions. Before a shippable push, bump with:

```bash
CURRENT=$(node -p "require('./package.json').version")
TAGS=$(git tag -l 'v[0-9]*' | tr '\n' ',')
NEXT=$(node scripts/release/next-version.mjs resolve "$CURRENT" "$TAGS")
node scripts/release/bump-version.mjs "$NEXT"
node scripts/release/stamp-changelog.mjs "$NEXT"
```

See `AGENTS.md`.

## Flow (all-or-nothing)

Push to **`main`** with a **new** `package.json` version (no `vX.Y.Z` tag yet):

1. Build npm tarball + Docker images (parallel)
2. If **any** build fails → remaining jobs cancel; **nothing** is published; **no** tag / GitHub Release
3. **Only if both builds succeed** → publish npm → Docker manifests → **git tag + GitHub Release** (always last)

If publish fails before the last step → no git tag / GitHub Release.

If that version’s tag already exists → workflow skips.

## Skip

Commit message:

```
[skip release]
```

## Secrets

- `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` — Docker Hub  
- npmjs — Trusted Publisher (OIDC); no `NPM_TOKEN`  
  - npmjs.com → `airoute` → Settings → Trusted Publisher → GitHub Actions  
  - user `foisalislambd`, repo `airoute`, workflow filename `release.yml`  
- `GITHUB_TOKEN` — provided by Actions (Packages + Releases)
