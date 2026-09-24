## Implementation

- [x] Validate this proposal before implementation.
- [x] Add the local memory permission store and move server policies to it.
- [x] Remove `acl` from the manifest and regenerate the lockfile.
- [x] Verify the resolved dependency graph has no `acl` or its MongoDB 2.x client.

## Verification

- [x] Test grant registration, wildcard methods, multiple roles, callback and promise checks.
- [x] Run the existing policy tests and lint.
- [ ] Confirm the full server suite in CI.
- [ ] Validate and archive the change; update the living specification.
- [ ] Open a pull request stacked on #2864.
