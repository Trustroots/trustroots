## Implementation

- [x] Reuse literal import/path analysis between the package and module guards.
- [x] Add production module upward-import enforcement and anonymous regression fixtures.
- [x] Wire both guard checks into local lint, affected checks and CI; document the scope.

## Verification

- [x] Validate this proposal before implementation.
- [x] Restack onto the completed shell/core cleanup; verify no existing upward imports or exceptions remain.
- [x] Run focused guard/affected/module regressions and full `pnpm check`.
- [x] Update the architecture checklist, archive the bounded change and update the living specification.
