## Implementation

- [x] Validate this proposal before implementation.
- [x] Prove clean Node 24 installation in Linux CI and resolve compatibility fixes.
- [x] Align runtime declarations, CI, containers and developer documentation.
- [x] Preserve the hybrid frontend and existing database and job interfaces.

## Verification

- [x] Verify development and production frontend and service-worker builds on Node 24.
- [x] Build development and production images with strict npm installation.
- [ ] Verify production Passenger application and worker startup.
- [ ] Verify native installation on macOS arm64.
- [x] Run client coverage without reducing the baseline.
- [x] Run server coverage without reducing the baseline.
- [x] Run the existing browser suite.
- [ ] Restore excluded worker tests and verify worker/Firebase compatibility.
- [ ] Confirm full coverage and browser checks on the final revision.
- [ ] Validate and archive the proposal and update living specifications.
- [x] Open the independent runtime pull request with verification evidence.

## Deferred maintenance

- [ ] Migrate lockfile format 2 to format 3 in a separate change; retain the
      explicit `.npmrc` setting until then.
