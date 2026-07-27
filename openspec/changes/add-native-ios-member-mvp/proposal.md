## Why

Trustroots currently serves members through a browser application only. A
native iOS app would make the core member experience—finding people and
offers, maintaining a profile, and holding conversations—available with an
interface designed for iPhone while retaining Trustroots as the source of
truth.

The existing HTTP API assumes a browser session and does not provide the
secure, explicit mobile session contract needed by a native application.

## What Changes

- Add a native SwiftUI iOS application for the member-facing MVP.
- Add versioned mobile authentication and member API endpoints, authenticated
  by revocable short-lived access tokens and refresh tokens stored only in the
  iOS Keychain.
- Keep mobile delivery additive: do not require rendered website, browser
  navigation, asset, or browser-session changes for native functionality.
- Deliver the member MVP: registration and sign-in, profile viewing and
  editing including photos, circles, map-based offer search and offer
  management, inboxes and conversations, and member-to-member experiences.
- Add a native `WKWebView` browser fallback, modelled on the Nostroots iOS
  browser, for member functionality that is not yet implemented natively,
  including the existing web flows for password recovery and email
  confirmation.
- Design a permissioned NIP-07 bridge for approved Trustroots and Hitchwiki
  HTTPS origins and a
  future shared Nostr-key Keychain group with Nostroots; key sharing is not a
  TestFlight MVP dependency.
- Keep native UI colours anchored to the established Trustroots palette rather
  than substituting generic platform accent colours.
- Plan APNs device-token registration and native notifications as a follow-on
  phase after the core TestFlight MVP is usable.

## Capabilities

### New Capabilities

- `native-ios-member-app`: a native iPhone application for the defined
  member-facing MVP.
- `mobile-member-api`: secure, versioned API access for native member clients.
- `native-web-identity-bridge`: permissioned access from the native browser to
  a Nostr signing key for explicitly trusted Trustroots web origins.

### Modified Capabilities

- `account-access`: native clients can register and authenticate through the
  supported mobile flow.
- `member-profiles`: native clients can view and manage their profile and
  photo.
- `circles`: native clients can browse circles and manage their memberships.
- `offers-and-search`: native clients can search offers and manage their own
  offers.
- `messaging`: native clients can read, send, and receive message state and
  notifications.

## Impact

- Adds an Xcode/SwiftUI project and its unit, integration, and UI tests under
  `apps/ios`.
- Adds an in-app `WKWebView` routing and permission layer for supported
  Trustroots website routes.
- A later coordinated Nostroots release is required before the two apps can
  share its existing private Nostr key; both applications must use the same
  Apple Developer Team and Keychain Access Group.
- Adds a mobile API module or mobile route layer to the Node/Express server,
  with authentication and token persistence.
- Administrator and moderation interfaces remain web-only; blocking, reference
  threads, offline authoring, and iPad optimisation are outside this MVP.
- Existing browser sessions, account-recovery flows, and browser API behaviour
  remain compatible. A data migration may be required to persist revocable
  mobile refresh tokens.
- Mobile-specific server behaviour is isolated under `/api/mobile/v0`, and the
  native projects do not become part of the website bundle.
