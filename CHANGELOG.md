# Changelog

All notable changes to zip-iterator are documented here.

## [3.3.3] - 2026-11-23

### Fixed

- Failed entry extraction now closes the output file before reporting the source error, allowing immediate cleanup on Windows.

## [3.3.2] - 2026-11-23

### Fixed

- Stream buffering now resolves the temp directory via `extract-base-iterator`'s `tmpdir()` (`os-shim` fallback) instead of falling back to a hard-coded `'/tmp'` path on Node 0.8 Windows.

### Changed

- Raised minimum `extract-base-iterator` dependency to `^3.5.0`.
