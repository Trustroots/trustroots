## Context

Trustroots is a Node/Express and MongoDB application with an AngularJS/React
browser client. Its protected endpoints authenticate through Express sessions
stored in a cookie. That approach is not an appropriate primary authentication
contract for a native iOS app: the app must not depend on browser cookies or
embed the website in a web view.

The MVP is a native iPhone application, written in Swift and SwiftUI. It
reuses the Trustroots domain model and server-side authorisation rules, but
does not reuse browser components for implemented native features. A native
`WKWebView` supplies the explicitly bounded fallback browser, following the
minimal `Nostroots Browser` iOS application pattern. It excludes all
administration and moderation tools.

`Nostroots Browser` and the more widely used Expo `nr-app` are separate
applications. The former is the implementation reference for the SwiftUI and
`WKWebView` shell; the latter is the potential source of an already-held Nostr
key after a deliberate shared-Keychain migration. This app must not conflate
the two or depend on either key store for its initial TestFlight release.

## Goals / Non-Goals

**Goals:**

- Ship a useful, fully native iPhone member application.
- Keep the website and its current browser-session authentication working
  without behavioural regressions.
- Give iOS a documented, versioned, least-privilege API contract.
- Release the core application through TestFlight before beginning APNs work.

**Non-Goals:**

- An administrator or moderator app.
- A hybrid wrapper or cross-platform implementation.
- Offline creation, editing, or message delivery; the MVP may cache safe
  read-only data for responsive presentation.
- iPad-specific layouts, Android, reference threads,
  blocking, background location tracking, native account
  recovery, Universal Links, and push notifications.

## Decisions

### Native application architecture

Create `apps/ios/Trustroots` as an Xcode project targeting a supported recent
iOS release. Use SwiftUI for presentation, structured concurrency for network
work, URLSession for transport, and Keychain Services for credentials.

Organise application features around Account, Profile, Circles, Search and
Offers, and Messaging. Inject protocol-based API clients and persistence so
unit tests do not need network access. Use XCTest for unit/API-contract tests
and XCUITest for the essential user journeys.

### Mobile authentication

Introduce pre-release `/api/mobile/v0` routes rather than adapting browser
cookies. Successful mobile registration or sign-in returns a short-lived
access token and a rotating refresh token. The app stores both only in the
Keychain; the access token is sent as a Bearer token. Refresh tokens are
hashed server-side, scoped to a device session, revocable individually, and
rotated on every refresh. Signing out revokes the active mobile session.

Access tokens expire after 15 minutes and refresh tokens after 30 days. The
native client refreshes proactively when possible and, after a 401, may rotate
and retry the original request exactly once. A rejected refresh clears the
credential pair and returns to sign-in with an explicit expired-session
message. HTTP 403 remains an authorisation result and is not treated as an
expired token by the bearer client.

This automatic retry applies only to documented `/api/mobile/v0` bearer
resources. Screens that still use a legacy browser route are explicitly draft
and must not infer that a cookie-route rejection invalidates a mobile bearer
session; each is migrated only when its versioned representation is available.
Concurrent bearer requests for the same server share a single refresh
operation, preventing a rotating refresh token from invalidating a second
request that observed the same expired access token.

The server reuses existing password validation, account eligibility,
confirmation, suspension, and authorisation rules. It must apply the same
privacy and visibility rules as the browser routes, rather than trusting a
client-supplied member identifier.

### Account recovery

Account confirmation and password recovery remain website flows for this MVP.
The iOS app opens the appropriate Trustroots page in its built-in browser, but
does not handle email links, account-recovery tokens, or Universal Links. This
keeps the first release focused on the authenticated member experience.

### In-app browser fallback and Nostr identity bridge

Use a native `WKWebView`, presented from SwiftUI, as the built-in browser for
selected Trustroots website destinations not yet available natively. It
presents account confirmation, password recovery, and explicitly supported
deferred member routes. Native screens remain the default for all MVP features
implemented in the app.

Maintain an allowlist of Trustroots HTTPS URLs and open all other links in the
system browser after user confirmation. Do not present administration or
moderation routes from this fallback.

Model the browser's Nostr support on Nostroots: inject a narrowly scoped
`window.nostr` NIP-07 bridge, identify the app with a dedicated user-agent,
and mediate every key operation natively. The bridge may only serve the fixed
Trustroots origin allowlist. It must not give arbitrary websites key access,
silently sign events, or pass the private key into JavaScript.

The Trustroots web application does not currently use the Nostr key as a
browser login credential. If a later website flow needs it, add an
origin-bound, expiring server challenge that the bridge signs, verify the
signature against the member's associated public key, and issue a normal
browser session. Do not treat `getPublicKey` alone as authentication.

The current Expo `nr-app` key is in its private Keychain group. The Trustroots
app therefore stores its own key or runs without bridge signing in the first
TestFlight MVP. Sharing the existing Expo-app key is a coordinated follow-on:
both applications must be signed by the same Apple Developer Team, enable the
same Keychain Access Group, and `nr-app` must migrate its existing private
Keychain item to that group. The Trustroots app must not attempt to read the
Expo app's private storage. The minimal `Nostroots Browser` app's own private
key remains a separate key unless it participates in the same migration.

The initial bridge follows the established Nostroots iOS browser contract:
`getPublicKey`, `signEvent`, `nip44.encrypt`, `nip44.decrypt`,
`nip04.encrypt`, and `nip04.decrypt`. It injects only a promise-based
`window.nostr` provider into the main frame, communicates through a named
`WKScriptMessageHandler`, and returns results through a private callback. An
app-local key can be generated or imported as an `nsec` or 64-character hex
secret and is retained only in the device Keychain. The native app owns every
permission decision; JavaScript never receives the secret.

Use an explicit origin policy for HTTPS origins under `trustroots.org` and
`hitchwiki.org`. These project-controlled origins are allowed automatically as
requested, while lookalike domains, clear-text origins and subframes are
rejected. Derive the origin from the actual script-message main frame rather
than the web view's mutable visible URL, and reject pending work after a
navigation. Changing or removing the key clears any remembered permissions
retained for future origin-policy expansion. This bridge is not a sign-in
mechanism: browser login requires a separate origin-bound, expiring server
challenge.

### Native visual language

Use the audited Trustroots palette in native views: primary green `#12B591`,
host yes `#58BA58`, host maybe `#F2AE43`, and meetup `#11B4DA`. Prefer system
surfaces for cards and use these colours deliberately for Trustroots actions,
status and map annotations. Do not introduce generic SwiftUI `.teal` or
unrelated default accents where a Trustroots colour is intended.

### API scope

The initial mobile API covers only the MVP journeys:

- sign-up, sign-in, refresh, and sign-out;
- current-member data and profile/photo read/update;
- circle catalogue/detail and membership read/join/leave;
- offer search by map bounds/location and circle, offer detail, and the
  current member's create/update/remove flows;
- inbox, thread history with pagination, sending replies, marking messages as
  read, unread count/synchronisation, and conversation-linked experience
  discovery and creation.

Responses use dedicated mobile representations and pagination metadata, not
raw database documents. API schemas, errors, and compatibility policy are
published alongside the server implementation.

Stable representations are introduced incrementally. A resource is not marked
complete until its native screen uses the versioned representation with bearer
authentication; legacy cookie payloads are an implementation reference, not a
mobile compatibility contract. Every protected error response includes a
stable machine-readable code alongside its member-facing message.

Public MapKit/Mapbox tiles, validator-approved Nostr relay subscriptions and
pages in the bounded website fallback do not carry the mobile bearer token.

Native API base URLs require HTTPS. The sole transport exception is an HTTP
loopback address in a debug Simulator build, allowing the Simulator to reach
the developer's Mac without making remote clear-text transport configurable.
Repeated sign-in and refresh failures are throttled by network source and a
one-way identity key. Expired and revoked sessions are removed by a MongoDB
TTL index at the end of the 30-day refresh lifetime.

### Website isolation

Treat the mobile API and native projects as additive surfaces. Production must
be able to deploy them without changing the rendered website, its assets,
navigation, or Express-session authentication. Mobile-specific behaviour stays
under `/api/mobile/v0`; native source and build outputs are not part of the web
bundle. The bounded browser fallback deliberately consumes existing HTTPS
pages without requiring those pages to detect or accommodate the app.

If mobile development uncovers a generally useful website fix, keep it
independently reviewable and verify it with the existing web suites. Do not make
an unrelated browser-client change a hidden prerequisite for a native feature.
This reduces the production blast radius and allows the mobile API to be
disabled without altering normal browser access.

### Map presentation

Use MapKit for native map interaction. The server continues to evaluate
offer-search filters and visibility. The client renders returned, authorised
offers as annotations and provides a list/empty state; it does not download
the complete offer set to filter locally.

The map also mirrors the website's optional **Community Notes via Nostroots**
layer. It subscribes directly to the Trustroots relay for validator-signed
kind `30398` events, decodes their Open Location Code tags locally, and never
treats an unvalidated event as a map location. Hosts, Meetups and Community
Notes remain independently controllable; Meetups and Community Notes start
enabled to make the community activity visible in a fresh installation.

### Resilient read-only cache

Cache successful authenticated GET responses in an account- and server-scoped
on-device cache protected by iOS data protection. A transport failure may fall
back to a previously decoded response, but HTTP authorisation and validation
errors must never be hidden by cached data. The shell presents a persistent,
plain-language offline banner whenever cached data is being shown. Mutations
remain unavailable offline and signing out or invalidating a session deletes
the previous account's cached responses.

### Photos

Use PhotosPicker and multipart upload to a mobile endpoint with the existing
server-side file validation and image-processing safeguards. The app requests
photo-library access only when a member chooses a profile picture.

### Rollout and compatibility

Deploy the mobile API and token storage before releasing the app through
TestFlight. Keep the API versioned and support the released app version for a
defined period. Server-side feature configuration can disable mobile sign-in
without changing browser behaviour. APNs and Universal Links can be proposed
as a later, independent change after the core app is validated.

## Risks / Trade-offs

- [Token theft from a compromised device] → Store credentials in Keychain,
  rotate refresh tokens, bind tokens to sessions, provide revocation, and
  never log credentials.
- [Different website and iOS authorisation behaviour] → Reuse policy services
  and exercise the same visibility scenarios with server contract tests.
- [In-app browser becomes an unbounded substitute for product work] → Limit it
  to an explicit allowlist and keep native screens as the default for all MVP
  journeys.
- [A browser session differs from a native session] → Do not share mobile
  tokens with the browser; explain when website sign-in is required.
- [Nostr private key is exposed to a website] → Keep the key in Keychain and
  expose only permissioned NIP-07 operations through a fixed origin allowlist.
- [The shared-key change breaks Nostroots users] → Make the Keychain migration
  an additive, independently tested Nostroots release with private-key fallback
  until adoption is complete.
- [Map result volume harms responsiveness] → Require bounded map-area queries
  and server pagination/clustering where necessary.
- [Cached private data appears for another member] → Namespace cache entries
  by normalised server and signed-in username, apply iOS file protection, and
  remove the active namespace on sign-out.

## Migration Plan

1. Add database indexes and a migration for hashed mobile sessions, if
   separate storage is required.
2. Deploy mobile endpoints and token revocation behind disabled configuration.
3. Exercise security and API-contract checks in staging.
4. Enable the feature for internal TestFlight users, then release
   incrementally through App Store Connect.
5. If rollback is needed, disable new mobile session issuance and push sends;
   existing browser access remains unaffected. Revoke issued mobile sessions
   if a security issue requires it.

## Open Questions

- Which minimum iOS version should Trustroots support?
- Should registration be included in the first TestFlight build or initially
  direct prospective members to the existing website?
- Which deferred member routes should be included in the first built-in
  browser allowlist beyond confirmation and recovery?
- Should browser signing be available in the first TestFlight build using an
  app-local key, or arrive only with the shared-key migration?
- What device-session listing and remote-revocation interface should follow
  the initial 30-day refresh-token implementation?
