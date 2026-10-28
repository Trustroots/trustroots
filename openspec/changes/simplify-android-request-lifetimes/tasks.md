- [x] 1. Add `LatestRequest` and focused JVM tests for replacement, cancellation,
      late completion and both re-entry boundaries.
- [x] 2. Migrate only `MemberProfileViewModel`'s six existing job slots to the
      helper, preserving the initial-load child request structure and explicit
      reference-refresh ownership.
- [ ] 3. Run the complete Android JVM unit-test suite and verify all existing
      stale-response, cancellation and session-invalidation cases remain green.
- [ ] 3a. Extend the validated ownership pattern to the listed ViewModels,
      retaining independent business revisions and permanent observers.
- [ ] 4. Validate the proposal and archive it with the final Android source
      changes.
