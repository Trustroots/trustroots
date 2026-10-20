## Why

The Android API client and UI currently embed English fallback text in API
models and exceptions. That makes those messages impossible to localise at the
point where Android has access to the active resource configuration. Some UI
state also stores a resolved string, which can leave stale-language text after
a configuration change.

## What Changes

- Give app-authored API failures stable, context-free identifiers for rejected
  sign-in, a missing member session, and a request rejected without a server
  message. Do not retain hardcoded English exception messages for compatibility
  with internal tests.
- Keep optional nonblank server messages as dynamic error data and expose
  machine-readable failure kinds or diagnostic codes from the API layer.
- Preserve nonblank server-provided error messages and display them verbatim.
- Resolve fallback text from Android string resources at the composable
  boundary; retain identifiers and optional server text in error state rather
  than translated strings.
- Localise failures held by both `SignInViewModel` and `CirclesViewModel` on the
  integrated implementation frontier, as well as Compose-local error state.
- Replace the API model's hardcoded unknown-member label with a resource-based
  UI fallback, reusing `profile_photo_default_member_label`.
- Keep API base URL validation diagnostics as internal developer/configuration
  errors; they may use machine-readable codes and remain outside user-facing
  copy.

## Capabilities

### Modified Capabilities

- `native-android-member-app`: localise API-generated and screen fallback
  messages using the active Android resource configuration.

## Impact

- Affects `MobileApiClient`, Android UI error presentation/state, and Android
  string resources under `apps/android`.
- Does not change HTTP requests, response parsing, server message precedence,
  API endpoints, or non-Android clients.
- No data migration or deployment coordination is required.
