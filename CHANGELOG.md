# Changelog

All notable changes to zip-iterator are documented here.

## [3.3.2] - 2026-11-23

### Fixed

- Stream buffering now resolves the temp directory via `extract-base-iterator`'s `tmpdir()` (`os-shim` fallback) instead of falling back to a hard-coded `'/tmp'` path on Node 0.8 Windows.

### Changed

- Raised minimum `extract-base-iterator` dependency to `^3.5.0`.
