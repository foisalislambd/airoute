# Changelog

All notable changes to AIRoute are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Open-source community files: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
  `SUPPORT.md`, GitHub issue/PR templates
- Root product `README.md` and monorepo `STRUCTURE.md`

### Changed

- Packages live under `packages/{web,open-sse,core}` (no convenience content
  symlinks under `packages/`)
- Docs i18n mirrors removed from the repo; English docs remain in `docs/`

### Security

- See [SECURITY.md](SECURITY.md) for the reporting process

## [0.1.0] — 2026-07-28

### Added

- Initial public repository layout for
  [foisalislambd/airoute](https://github.com/foisalislambd/airoute)
- Local AI gateway: Next.js dashboard, open-sse streaming engine, core libs
- OpenAI-compatible `/v1` surface, combo routing, provider connections

[Unreleased]: https://github.com/foisalislambd/airoute/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/foisalislambd/airoute/releases/tag/v0.1.0
