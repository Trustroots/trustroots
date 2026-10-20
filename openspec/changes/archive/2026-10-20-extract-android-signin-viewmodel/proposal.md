# Extract Android sign-in state into a ViewModel

## Why

Android sign-in currently keeps credentials, loading and error state inside a
composable in `TrustrootsApp.kt`. This makes the form state dependent on the
screen composition and leaves the authentication interaction difficult to
maintain independently. A screen-scoped ViewModel will give the sign-in flow a
single immutable state model and explicit user events while preserving the
existing session boundary and user journey.

## What Changes

- Move sign-in form state and submission handling into `ui/signin` with a
  `SignInViewModel`, immutable state, and explicit events.
- Keep the existing API sign-in request, username trimming, progress and
  failure feedback, and ability to correct credentials and submit again.
- Preserve the encrypted session-store write and authenticated navigation in
  the existing app-level callback.
- Preserve Join and Forgot password browser routes, sign-in analytics, and the
  existing keyboard-aware form and footer layout.
- Retain entered fields and an in-flight request across Activity recreation
  through a sign-in destination store owned by an Activity-retained holder;
  keep credentials in memory only and clear the destination store when
  sign-in exits.

## Capabilities

### Modified Capabilities

- `native-android-member-app`: sign-in state survives rotation and the sign-in
  screen separates immutable interaction state from Compose rendering.

## Impact

- Android-only changes under `apps/android`, including the sign-in screen,
  ViewModel and focused unit or Compose coverage.
- Adds `androidx.lifecycle:lifecycle-viewmodel:2.10.0` to declare the direct
  ViewModel API dependency at the existing Lifecycle version.
- No server, website, iOS, encrypted session format, or data migration change.
- Existing `SignInSessionJourneyTest`,
  `TrustrootsOfflineAndSignInLoadingJourneyTest`, and
  `MainActivityRotationJourneyTest` remain in the regression suite, with added
  sign-in → sign-out → sign-in and in-flight rotation coverage.
