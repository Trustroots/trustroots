## Implementation

- [x] Validate the proposal requirements and scenarios; strict CLI validation passes.
- [x] Synchronise hosting editor tabs with URL fragments.
- [x] Add a compact map to visible active hosting offers.
- [x] Cover direct links, history navigation and profile maps in client/e2e tests.
- [x] Run relevant checks, update living specs and archive the change.

## Verification

- `pnpm check` passes on the current main base: lint, TypeScript, all 1,856
  client tests and four configuration tests.
- All 105 offers client tests pass with 100% statement, branch, function and
  line coverage for the four changed components.
- Four desktop/mobile browser scenarios pass, plus two authentication setup
  tests. They cover tab history, the owner location link, compact profile maps,
  mobile control visibility, map sizing and saving from mobile editors.
- Captured and inspected screenshots of the accommodation panel and mobile
  location editor. Changed browser specs also produce screenshots in the
  repository's labelled PR workflow.
