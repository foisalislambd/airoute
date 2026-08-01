# Agent guide — AIRoute

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Version bump (required after user-facing work)

GitHub Actions **does not** bump versions. Before finishing a task that should ship (feature, fix, publishable change), **bump the version yourself** and include it in the commit(s) the user will push.

### Scheme

`1.0.0` → … → `1.0.9` → `1.1.0` → … → `1.9.9` → `2.0.0`

### Steps (run from repo root)

1. Compute next version (or use an explicit `X.Y.Z` if the user asked):

```bash
CURRENT=$(node -p "require('./package.json').version")
TAGS=$(git tag -l 'v[0-9]*' | tr '\n' ',')
NEXT=$(node scripts/release/next-version.mjs resolve "$CURRENT" "$TAGS")
echo "$CURRENT → $NEXT"
```

2. Write it everywhere + stamp CHANGELOG:

```bash
node scripts/release/bump-version.mjs "$NEXT"
node scripts/release/stamp-changelog.mjs "$NEXT"
```

That updates:

- root `package.json` + `package-lock.json`
- `packages/web/package.json`
- `packages/core/package.json`
- `packages/open-sse/package.json`
- `CHANGELOG.md`

3. Commit the version files with the rest of the work (or a follow-up commit).  
   Push to `main` → Release workflow tags `v$NEXT` and publishes npm + Docker.

### Do **not** bump when

- User said not to release / docs-only / CI-only / WIP  
- Commit should use `[skip release]` (no tag/npm/Docker even if version changed)

### Skip publish without bumping

Put this in the commit message:

```
[skip release]
```
