## Implementation

- [x] Add the common Compose dashboard and make it the authenticated pilot root.
- [x] Cover dashboard actions, Back, and the existing sign-in/reply journey.
- [x] Run available checks and record platform verification limitations.

Android app/test APK compilation and both focused API 36 emulator journeys pass.
The Android screenshot was inspected locally. iOS compilation and runtime checks
require macOS CI; the corresponding XCTest journey is updated but not run here.

`pnpm check` passed lint and typechecking, then reported 308 passing client
suites (2,757 tests) and two unchanged suites failing during import with
`util.isString is not a function` in the `path` dependency. Full OpenSpec
validation reports six pre-existing change failures; the dashboard proposal and
updated shared-mobile-build living spec validate strictly.
