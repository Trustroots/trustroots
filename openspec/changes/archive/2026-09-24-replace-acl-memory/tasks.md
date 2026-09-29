## Implementation

- [x] Validate this proposal before implementation.
- [x] Add the local memory permission store and move server policies to it.
- [x] Remove `acl` from the manifest and regenerate the lockfile.
- [x] Verify the resolved dependency graph has no `acl` or its MongoDB 2.x client.

## Verification

- [x] Test grant registration, wildcard methods, multiple roles, callback and promise checks.
- [x] Run the existing policy tests and lint.
- [x] Confirm the full server suite in CI ([run 35993334252](https://github.com/Trustroots/trustroots/actions/runs/35993334252): server, client, e2e, images and coverage summary passed).
- [x] Validate and archive the change; update the living specification.
- [x] Open a pull request stacked on #2864 ([#2868](https://github.com/Trustroots/trustroots/pull/2868)).
