## Context

Trustroots is a Node/Express and MongoDB application with an AngularJS/React
browser client. Its existing JSON endpoints authenticate through an Express
session cookie and already apply the domain policies needed by the native MVP.
The native app can treat the signed cookie as an opaque credential without
sharing it with its embedded browser.

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
- Reuse the established policy-protected API while the native MVP is validated.
- Release the core application through TestFlight before beginning APNs work.

**Non-Goals:**

- An administrator or moderator app.
- A hybrid wrapper or cross-platform implementation.
- Advertising, advertising identifiers, advertising attribution, behavioural
  profiling, or selling member or analytics data. Trustroots does not use
  advertising and will not introduce it.
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
Use the existing production App Store Connect record and its
`org.trustroots.trustrootsApp` bundle identifier so TestFlight builds and a
later App Store release share one application identity. Use calendar versions
in `YYYY.M.D` form for public iOS releases and a small monotonically increasing
build counter for repeated uploads of the same dated release.

Organise application features around Account, Profile, Circles, Search and
Offers, and Messaging. Inject protocol-based API clients and persistence so
unit tests do not need network access. Use XCTest for unit/API-contract tests
and XCUITest for the essential user journeys.

### Existing-session authentication

Use `/api/auth/signin` and capture the signed `connect.sid` cookie returned by
the established website-session flow. Store the opaque name/value pair only in
Keychain with this-device-only protection, then attach it explicitly to
requests for the configured Trustroots origin. Disable URLSession's shared
cookie storage so the credential is not implicitly exposed to the `WKWebView`.

Use the existing protected `/api/*` routes directly. Their policy middleware
remains the authority for confirmation, suspension, privacy, visibility and
mutation permissions. Signing out calls `/api/auth/signout` and deletes the
Keychain credential and account-scoped offline cache.

This deliberately accepts the website session's current lifetime and
revocation semantics for the MVP. A versioned bearer contract remains a
possible follow-on, but it should be proposed after native usage demonstrates
which representations and lifecycle controls are actually required.

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
moderation routes from this fallback. Hide the website's global `#tr-header`
on `www.trustroots.org` inside the bounded browser because the native shell
already provides navigation; do not change the header on the normal website.

Send aggregate native screen pageviews directly to the existing self-hosted
Umami `/api/send` endpoint. Use the dedicated production native-app website
identifier, `/ios/`-prefixed paths, and an `ios.trustroots.org` hostname. Use
an ephemeral cookie-free session and do not send the member identity, email,
API session cookie, advertising identifier, or another persistent device
identifier. Analytics are only for aggregate product understanding and must
never be used for advertising, behavioural profiling, or sale.

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
host yes `#58BA58`, host maybe violet `#7C5CBF`, and meetup `#11B4DA`. Prefer system
surfaces for cards and use these colours deliberately for Trustroots actions,
status and map annotations. Do not introduce generic SwiftUI `.teal` or
unrelated default accents where a Trustroots colour is intended.

Keep the four primary destinations in a persistent bottom navigation bar so
content remains clear of the device camera area and is reachable one-handed.
Hide that bar while the on-screen keyboard is presented, and place list
filters in keyboard-aware bottom safe-area insets so the active input remains
visible directly above the keyboard.

Use the top device cut-out area as part of the visual shell: normal
destinations show a green Trustroots brand strip with the white tree mark
tightly to the left of the Dynamic Island and direct Profile and Account
actions tightly to its right. The tree mark opens the Trustroots home page.
Circle detail artwork and the profile photo header extend into that area
instead, with the same island controls floating over the artwork. Both
immersive headers use a darkened edge-to-edge cover, identifying text on the
left, and the original circle artwork or member portrait as a crisp circular
image on the right. Built-in browser routes replace the left-side home-only
control with an explicit Back control beside Home.

### Existing API scope

The client maps native journeys to the established routes for authentication,
profiles and photos, circles and memberships, offers, contacts, experiences,
messages, account settings and support. Native contract tests pin the paths,
cookie header and response decoding used by the app. Existing server and
browser tests remain responsible for policy and mutation behaviour.

Member profiles obtain accommodation details from the existing
`/api/offers-by/:userId` route; no profile or offer API shape is extended.
Member images use the established authenticated
`/api/users/:userId/avatar` redirect so local, Gravatar and other configured
avatar sources behave like the website. The native session cookie is removed
before following any cross-origin image redirect.

Public MapKit/Mapbox tiles, validator-approved Nostr relay subscriptions and
pages in the bounded website fallback do not carry the stored API session
credential.

The native app uses the production Trustroots HTTPS API origin. Debug and
release builds do not expose an API-origin selector or permit clear-text
transport.

### Website isolation

Treat the native projects as additive consumers. Production can build and
distribute them without changing the rendered website, its assets, navigation
or Express-session authentication. Native source and build outputs are not
part of the web bundle. The bounded browser fallback consumes existing HTTPS
pages without requiring those pages to detect or accommodate the app.

If mobile development uncovers a generally useful website fix, keep it
independently reviewable and verify it with the existing web suites. Do not make
an unrelated browser-client change a hidden prerequisite for a native feature.
This reduces the production blast radius and keeps normal browser access as
the canonical compatibility contract.

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

Stop clustering hosts once the visible area is sufficiently close for
individual selection. Present a selected host in a strong, full-width card at
the bottom of the map, including the accommodation status, description and
guest capacity already returned by the offer endpoint.
Use a couch symbol for an individual host and retain numbered circles for
clusters.

Cache the assembled circle-detail member groups briefly per account and circle.
This avoids repeating the profile-membership and offer searches when a member
returns to the same circle during normal navigation.

### Resilient read-only cache

Cache successful authenticated GET responses in an account- and server-scoped
on-device cache protected by iOS data protection. A transport failure may fall
back to a previously decoded response, but HTTP authorisation and validation
errors must never be hidden by cached data. The shell presents a persistent,
plain-language offline banner whenever cached data is being shown. Mutations
remain unavailable offline and signing out or invalidating a session deletes
the previous account's cached responses.

### Photos

Use PhotosPicker and multipart upload to the existing avatar endpoint with its
server-side file validation and image-processing safeguards. The app requests
photo-library access only when a member chooses a profile picture.

### Rollout and compatibility

Exercise the existing routes and native decoders against staging before
releasing the app through TestFlight. API versioning, APNs and Universal Links
can be proposed later after the core app is validated.

## Risks / Trade-offs

- [Session-cookie theft from a compromised device] → Store the opaque
  credential in Keychain, restrict transport to the configured HTTPS origin
  and never log it.
- [Existing response formats change] → Pin the consumed fields in native
  contract tests and keep app releases coordinated with website deployment.
- [In-app browser becomes an unbounded substitute for product work] → Limit it
  to an explicit allowlist and keep native screens as the default for all MVP
  journeys.
- [The embedded browser has an independent session] → Do not share the native
  API credential with it; explain when website sign-in is required.
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

1. Exercise security and API-contract checks against staging.
2. Enable the feature for internal TestFlight users, then release
   incrementally through App Store Connect.
3. If rollback is needed, withdraw the native build; existing browser access
   remains unaffected.

## Open Questions

- Which minimum iOS version should Trustroots support?
- Should registration be included in the first TestFlight build or initially
  direct prospective members to the existing website?
- Which deferred member routes should be included in the first built-in
  browser allowlist beyond confirmation and recovery?
- Should browser signing be available in the first TestFlight build using an
  app-local key, or arrive only with the shared-key migration?
- Does release experience justify a separately versioned native API and
  per-device session revocation?
