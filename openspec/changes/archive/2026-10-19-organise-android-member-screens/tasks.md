## Implementation

- [x] Split the six member screens into packages and extract profile components.
- [x] Move shared helpers/components into `ui/common` and update all consumers.
- [x] Document the source layout and follow-up scope for #3234.

## Validation

- [x] Confirm extracted screen bodies preserve existing behaviour.
- [x] Run Android unit tests, lint, debug build and instrumentation compilation.
- [x] Run existing affected Android UI journeys with anonymous fixtures.
- [x] Run `pnpm check` before committing.
- [x] Validate and archive the proposal, updating the living specification.

## Results

- Source comparison: all 17 extracted declarations and all five shared source
  bodies match their originals; all existing Kotlin bodies remain unchanged.
- `pnpm check`: passed, including 251 client suites and 1,874 tests.
- Android unit tests: 130 passed; lint and both debug APK builds passed.
- Full API 36 journey run: 258 passed, none skipped.
- Android aggregate line/branch coverage ratchet: passed with the existing
  baseline unchanged. API 32 compatibility coverage remains enabled in CI.
- Removed an invalid pre-existing `assertDoesNotExist` extension import from
  `ShellBrowserRoutesJourneyTest`; its assertions and test cases are unchanged.
