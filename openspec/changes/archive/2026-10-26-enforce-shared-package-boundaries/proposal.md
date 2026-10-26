## Why

The logger extraction introduced the first shared infrastructure package. Its lower-tier ownership currently relies on convention: an import into application configuration, a feature module or the client shell could silently couple it to the application again. Issue #3358 calls for enforceable import boundaries.

## What Changes

- Add a static guard under `tooling/guards` for production source in `packages/*`.
- Reject repository imports outside the importing package unless they target another shared package declared as a `workspace:*` dependency.
- Recognise static imports, re-exports, import types, CommonJS imports and literal dynamic imports through package names, root aliases and relative paths.
- Reject source-bearing packages with invalid manifests and production source symlinks so source cannot silently escape the scan.
- Run the guard and its regression tests locally and in CI. Keep broader module/layer guards as follow-up work.

## Impact

This is developer tooling only. No application behaviour, dependencies, coverage thresholds or end-to-end tests change. Browser tests are not appropriate for a static source guard; temporary repository fixtures exercise allowed and forbidden imports instead.

Tests may cross application boundaries to exercise integration contracts, so package test files and test directories are excluded from this production-source rule. External dependencies remain under the existing root dependency policy.
