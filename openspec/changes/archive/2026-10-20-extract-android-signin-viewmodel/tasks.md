## 1. Sign-in state extraction

- [x] 1.1 Add the Activity-retained holder and independently cleared
      sign-in-destination `ViewModelStore`; use Lifecycle 2.10.0-compatible
      APIs and declare `lifecycle-viewmodel:2.10.0` directly.
- [x] 1.2 Add `ui/signin` immutable state, explicit events and ViewModel,
      including pending-result acknowledgement and initial-message handling.
- [x] 1.3 Move sign-in rendering to `ui/signin` and collect immutable state;
      keep the existing keyboard-aware layout, footer, analytics, Join and
      password-recovery routes.
- [x] 1.4 Keep encrypted session persistence and signed-in navigation in the
      existing `TrustrootsApp` callback.
- [x] 1.5 Add focused unit coverage for state transitions, submit progress,
      error feedback, credential correction and successful result handling.

## 2. Regression coverage and validation

- [x] 2.1 Preserve the existing sign-in session, offline/loading and rotation
      journey tests; add coverage for sign-in → sign-out → sign-in and an
      in-flight request during Activity recreation.
- [x] 2.2 Validate this OpenSpec change before implementation and update the
      living `native-android-member-app` specification when the change is
      complete.
- [x] 2.3 Run Android unit tests, lint and the relevant emulator journeys.
