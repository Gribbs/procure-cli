## [0.1.2](https://github.com/Gribbs/procure-cli/compare/v0.1.1...v0.1.2) (2026-06-01)


### Bug Fixes

* redact client credentials from OAuth error output ([6ddf2e4](https://github.com/Gribbs/procure-cli/commit/6ddf2e49777cf889c9560fbdc5d213b8edbdf5ec))

## [0.1.1](https://github.com/Gribbs/procure-cli/compare/v0.1.0...v0.1.1) (2026-05-29)


### Bug Fixes

* load OIDC-capable npm plugin for releases ([b944877](https://github.com/Gribbs/procure-cli/commit/b9448770f63232739252e3c8eea0972cfd781786))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

> Releases from here on are managed automatically by
> [semantic-release](https://github.com/semantic-release/semantic-release).

## [0.1.0] - 2026-04-23

### Added
- Initial scaffolding for `procure-cli`.
- Encrypted profile storage at `~/.procure/config.json` (AES-256-CBC).
- OAuth 2.0 client-credentials flow with on-disk token caching.
- `configure`, `login`, `whoami`, `raw`, `list-services`, `list-actions` commands.
- Service registry covering 16 Procurify API tags (read-only actions).
- Dual pagination handling (`metadata.pagination.next` and top-level `pagination.next`).
- Filter passthrough with kebab-case → snake_case rewriting.
- Output formats: `json`, `jsonl`, `csv`, `table`, `tsv`.
- Path parameter support via positional argument or `--id` flag (equivalent).
- Stdin batching with `-` as the path-param value.
- Debug mode (`--debug` / `PROCURE_DEBUG=1`), HAR export (`--debug-har`),
  structured JSON logs (`--log-format json`), log-file mirroring (`--log-file`).
- `--api-version` override for endpoint version pinning.
