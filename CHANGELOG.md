# Changelog

All notable changes to AIRoute are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.8] — 2026-08-03

### Fixed

- Adopt legacy OmniRoute `_omniroute_migrations` into `_airoute_migrations` on
  boot so upgraded DBs no longer trip the mass-pending migration safety abort
- Desktop instrumentation-hook failures no longer print a false Android/Termux
  cache hint; the real cause (e.g. migration abort) is shown instead

## [1.0.7] — 2026-08-01

## [1.0.6] — 2026-08-01

### Changed

- npm publish via Trusted Publisher (OIDC); no `NPM_TOKEN` / EOTP in CI

## [1.0.5] — 2026-08-01

### Fixed

- npm `prepublishOnly`: stop running a doomed MITM `tsc` under the monorepo
  layout (path aliases pull files outside `rootDir`); stage `packages/core/mitm`
  into `dist/src/mitm/` instead so publish logs stay clean

## [1.0.4] — 2026-08-01

## [1.0.3] — 2026-08-01

## [1.0.2] — 2026-08-01

## [1.0.1] — 2026-08-01

### Added

- Open-source community files: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
  `SUPPORT.md`, GitHub issue/PR templates
- Root product `README.md` and monorepo `STRUCTURE.md`
- npm publish wiring: root `bin`/`files`/`prepublishOnly`, standalone Next
  build, and pack-artifact policy adapted for `packages/*`
- Docker + multi-registry GitHub Actions: npmjs, GitHub Packages,
  Docker Hub, and GHCR (`airoute`)
- Auto Release workflow (`release.yml`) with roll-at-9 versioning
  (`1.0.0` → `1.0.9` → `1.1.0`) and GitHub Release + tag creation

### Changed

- Packages live under `packages/{web,open-sse,core}` (no convenience content
  symlinks under `packages/`)
- Docs i18n mirrors removed from the repo; English docs remain in `docs/`
- Public version line starts at **1.0.0**

### Security

- See [SECURITY.md](SECURITY.md) for the reporting process

## [1.0.0] — 2026-08-01

### Added

- First public release line for npm + Docker (Hub/GHCR) + GitHub Packages

## [0.1.0] — 2026-07-28

### Added

- Initial public repository layout for
  [foisalislambd/airoute](https://github.com/foisalislambd/airoute)
- Local AI gateway: Next.js dashboard, open-sse streaming engine, core libs
- OpenAI-compatible `/v1` surface, combo routing, provider connections

[Unreleased]: https://github.com/foisalislambd/airoute/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/foisalislambd/airoute/releases/tag/v1.0.0
[0.1.0]: https://github.com/foisalislambd/airoute/releases/tag/v0.1.0
