## Implementation

- [x] Validate this proposal before implementation.
- [x] Prove clean Node 24 installation in Linux CI and resolve compatibility fixes.
- [x] Align runtime declarations, CI, containers and developer documentation.
- [x] Preserve the hybrid frontend and existing database and job interfaces.

## Verification

- [x] Verify development and production frontend and service-worker builds on Node 24.
- [x] Build development and production images with strict npm installation.
- [x] Verify production Passenger application and worker startup (CI at `2a1721b1b`).
- [x] Add production-image native file detection to the startup check.
- [ ] Verify native installation on macOS arm64.
- [x] Run client coverage without reducing the baseline.
- [x] Run server coverage without reducing the baseline.
- [x] Run the existing browser suite.
- [ ] Restore excluded worker tests and verify worker/Firebase compatibility.
- [x] Confirm full coverage and browser checks at reviewed revision `2a1721b1b`.
      Require passing checks again on subsequent revisions before merge.
- [ ] Validate and archive the proposal and update living specifications.
- [x] Open the independent runtime pull request with verification evidence.

## Deferred maintenance

- [ ] Migrate lockfile format 2 to format 3 in a separate change; retain the
      explicit `.npmrc` setting until then.
