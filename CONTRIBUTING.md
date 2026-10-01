# Contributing

Thanks for wanting to improve AIRoute. The project is open source under the MIT license.

## What to know first

AIRoute runs only on the local machine. Changes should keep provider keys on disk, and the server should keep refusing addresses that are not loopback.

Do not open a pull request that contains API keys, router keys, database files, or `secret.key`.

## Set up

You need Go 1.26 or newer and Node.js 20 or newer.

```bash
git clone https://github.com/foisalislambd/airoute.git
cd airoute
npm install
```

Run the server and the panel in two terminals:

```bash
npm run dev:server
npm run dev:panel
```

The panel is at `http://127.0.0.1:5173`. The router is at `http://127.0.0.1:8787`. More detail is in [docs/develop.md](docs/develop.md).

## Before you open a pull request

1. Fork the repo and create a branch from `main`.
2. Keep the change focused. One bug or one feature is easier to review than several mixed together.
3. Run the tests that cover what you touched:

```bash
go test ./apps/server/...
node --test packages/cli/bin/airoute.test.js
```

4. If you changed the panel, build it with `npm run build:panel`.
5. Fill in the pull request template. Say what changed and how you checked it.

Do not hand-edit `apps/server/internal/catalog/catalog_generated.go`. That file is generated.

Do not bump the version in the root `package.json` unless the change is meant to be a release. A higher version on `main` publishes to npm and GitHub. Put `skip release` in the commit message when a push to `main` should not publish.

## Issues

Use a bug report when something fails, and a feature request when you want new behavior. A security problem should not go in a public issue. Use [SECURITY.md](SECURITY.md).

## Conduct

Be direct and respectful. The short version is in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
