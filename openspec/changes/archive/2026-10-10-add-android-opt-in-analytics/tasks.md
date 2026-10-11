## Implementation

- [x] Add a consent store and bounded, independent Umami transport.
- [x] Add opt-in controls and lifecycle/navigation tracking.
- [x] Add unit and native end-to-end tests for consent, persistence, payload privacy and opt-out.
- [x] Update Android documentation.
- [x] Run Android checks, validate and archive this change, and update living specs.

## Validation

- Android unit suite: 36 passing tests, including payload privacy, consent, global-cookie exclusion and redirect rejection.
- `lintDebug`, `assembleDebug`, `assembleDebugAndroidTest` and `assembleRelease`: passed.
- Native emulator tests: consent/persistence/opt-out journey, Account settings and Account responsiveness: three passing tests.
- Existing server/client coverage thresholds and browser e2e tests are unchanged. Native instrumentation covers this Android-only functionality.
