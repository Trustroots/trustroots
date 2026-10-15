## Implementation

- [x] Add targeted comparison fetching with shallow-history regression tests.
- [x] Balance E2E project groups and preserve complete project coverage.
- [x] Record and reuse per-file server durations with deterministic fallback.
- [x] Preserve the pnpm store location across image build and CI runtime.
- [x] Run local checks and validate the complete PR workflows and timings.

Validation: `pnpm check`, 19 Python regressions and 37 focused Mocha tests pass.
The first complete PR workflow passed in 7m 52s with full coverage; the next run
will additionally measure allocation using its saved server timing data.
