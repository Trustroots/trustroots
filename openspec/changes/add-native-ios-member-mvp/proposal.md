## Why

Trustroots currently serves members through a browser application only. A
native iOS app makes the core member experience available through an interface
designed for iPhone while retaining Trustroots as the source of truth.

The existing policy-protected JSON routes already cover the MVP journeys.
Reusing them avoids a parallel route tree and preserves the website's
authorisation and visibility behaviour.

## What Changes

- Add a native SwiftUI iOS application for the member-facing MVP.
- Authenticate through the existing `/api/auth/signin` website-session flow,
  keep the signed session cookie in the iOS Keychain and call the established
  `/api/*` resources.
- Deliver native profile, member-search, circle, offer-search, contacts,
  experiences, messaging, account and support interfaces, including the
  established member-reporting and blocking safeguards.
- Keep confirmation and password recovery in an allowlisted `WKWebView`
  because those are existing website flows.
- Add a permissioned NIP-07 bridge for approved Trustroots and Hitchwiki HTTPS
  origins without making shared Nostroots-key access a release dependency.
- Keep administration and moderation web-only and keep native sources out of
  the website bundle.

## Capabilities

### New Capabilities

- `native-ios-member-app`: a native iPhone application for the defined
  member-facing MVP.
- `native-web-identity-bridge`: permissioned access from the native browser to
  a Nostr signing key for explicitly trusted project origins.

### Modified Capabilities

- `account-access`: the native client establishes an existing Trustroots
  website session and stores its credential securely.
- `member-profiles`, `circles`, `offers-and-search`, and `messaging`: the
  existing protected JSON routes gain a native consumer without changing their
  server contract.

## Impact

- Adds an Xcode/SwiftUI project and tests under `apps/ios`.
- Adds no mobile server routes, token models, database migration or website
  navigation changes.
- Relies on the current website-session lifetime and response formats; a
  separately proposed versioned API can replace this contract later if native
  release experience demonstrates that it is needed.
- Existing browser sessions and account-recovery behaviour remain unchanged.
