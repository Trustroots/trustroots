## Implementation

- [x] Add a consent store and bounded, independent Umami transport.
- [x] Add opt-in controls and lifecycle/navigation tracking.
- [x] Add unit and native end-to-end tests for consent, persistence, payload privacy and opt-out.
- [x] Update Android documentation and synchronise the F-Droid recipe copy.
- [x] Run Android checks, validate and archive this change, and update living specs.

## Validation

- Android unit suite: 36 passing tests, including payload privacy, consent, global-cookie exclusion and redirect rejection.
- `lintDebug`, `assembleDebug`, `assembleDebugAndroidTest` and `assembleRelease`: passed.
- Native emulator tests: consent/persistence/opt-out journey, Account settings and Account responsiveness: three passing tests.
- F-Droid 2.4.5: isolated `readmeta` and `lint org.trustroots.android` passed with the official category configuration. GitHub release/tag lookup confirmed version 100015 and commit 52839d4d3aa5a0e8c972f4101dd17371e6b31c0e. `checkupdates` could not complete because its upstream clone was interrupted.
- Existing server/client coverage thresholds and browser e2e tests are unchanged. Native instrumentation covers this Android-only functionality.
