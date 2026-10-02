## Why

The native Android app already covers core member journeys, but its menu and
several interaction patterns still diverge from the phone website (≤767px).
Members should get one coherent product: phone web is the UX reference for
Android information architecture and journeys, while Compose remains the
native presentation layer.

Documenting the full parity programme in OpenSpec keeps later slices (profile
chrome, messaging, search, Host/experiences) aligned instead of inventing
one-off navigation.

## What Changes

- Adopt the phone web member experience as the Android UX reference.
- Phase native parity: Menu → profile chrome → messaging → search → native
  Host / experiences / remaining account settings.
- Keep Sign out on Account only (intentional phone-friendly departure from
  web `/navigation`).
- Use the existing allowlisted WebView only for deferred Trustroots HTTPS
  flows; confirm before leaving for non-allowlisted hosts.
- Keep administration and moderation on the website.
- Leave iOS out of this change (it may mirror later).

## Capabilities

### Modified Capabilities

- `native-android-member-app`: Android member IA and journeys follow phone web
  patterns for the defined parity phases, without admin tools.

## Impact

- Changes `apps/android` UI and related Compose tests.
- Extends the Android OpenSpec delta for phone-web parity requirements.
- Does not change server routes, browser behaviour, or the iOS app.
- Complements `add-native-android-member-mvp` (foundation); this change owns
  UX alignment and remaining member parity.
