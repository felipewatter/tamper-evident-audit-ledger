# Changelog

## 0.1.1 (unreleased)
- Block appending to corrupted hash chains and reject missing audit files.
- Validate malformed JSON records and prevent symlink-backed audit state.
- Correct TypeScript distribution layout and modernize dependency auditing.
- Add regression tests, improve documentation, and move CI to supported Node versions.

## 0.1.0
- Initial release: hash-chained JSONL ledger, optional Ed25519 signatures, CLI (init/append/verify/pretty).
