## Context

Trustroots has a native iOS member application and an early Kotlin/Jetpack
Compose Android application. Both consume the existing policy-protected JSON
routes through the established Express website session. Android currently has
the secure session foundation, bounded browser and initial signed-in shell, but
the full member journeys are not yet complete.

The Android application follows the iOS product outcomes under the
`ios-led-native-parity` change. Shared specifications and server policy remain
authoritative. Android retains platform conventions for navigation, system
back, keyboard and insets, permissions, accessibility, storage and lifecycle.

## Goals / Non-Goals

**Goals:**

- Deliver the complete defined native Android member MVP.
- Reuse the existing website-session and policy-protected API contracts.
- Provide native profiles, circles, map search, messages, experiences, account
  and safety journeys.
- Keep member credentials and cached private data protected and account-scoped.
- Verify stable contracts with unit tests and journeys with Compose UI tests.
- Make the build suitable for internal Android testing before notification
  work begins.

**Non-Goals:**

- Administration or moderation interfaces.
- A hybrid wrapper or cross-platform UI framework.
- Pixel-identical iOS presentation.
- Advertising, advertising identifiers, behavioural profiling or sale of data.
- A new Android-specific server route tree or bearer-token model.
- Offline mutations or message delivery.
- Firebase Cloud Messaging as a prerequisite for the core MVP.

## Decisions

### Native application architecture

Keep the application under `apps/android`, written in Kotlin and Jetpack
Compose. Use coroutines for network work, protocol-shaped API boundaries for
testability, Android Keystore for cryptographic keys and platform lifecycle
owners for resource-heavy views.

Organise product code by Account, Profile, Circles, Search/Map and Messaging
rather than accumulating all destinations in the application shell. The shell
owns session invalidation and primary navigation; feature screens own their
loading, empty, error and retry states.

### Existing-session authentication

Authenticate with `/api/auth/signin`, inspect every `Set-Cookie` response value
and retain only the signed `connect.sid` name/value pair. Store it through
Keystore-backed authenticated encryption, attach it only to the configured
Trustroots origin and remove it on sign-out or authentication rejection.

Treat both HTTP 401 and 403 from protected member routes as possible session
invalidation because the established routes use both statuses. The server
remains authoritative for confirmation, suspension, visibility and mutation
eligibility.

### Android navigation and visual language

Use a persistent, labelled bottom navigation bar for Circles, Search, Messages
and Menu, matching the iOS information architecture. Keep a compact Trustroots
brand header at the top. Hide bottom navigation while the keyboard is open
where it would obscure an active composer or filter.

Use the audited Trustroots palette rather than generic Material accent colours.
Meet Android touch-target, contrast, content-description, font-scaling and
system-back expectations.

### Existing API scope

Consume the established routes for profiles and avatars, circles and
memberships, offers, contacts, experiences, messages, blocked members, account
settings and support. Keep decoders tolerant of absent optional profile data
and deleted message participants while rejecting invalid required identifiers
and coordinates.

Contract tests pin consumed paths, query filters, cookie headers and
representative payload decoding. Existing server suites remain responsible for
authorisation and mutation policy.

### Native map

Use maintained MapLibre Native Android rendering inside Compose. Use a public
HTTPS vector style with visible attribution and no Trustroots member
credential. The map starts on the same Lisbon-centred region as iOS and
requests authorised offers only for the visible bounds using the established
`/api/offers` filters.

Render hosts, meetups and validator-approved Community Notes as distinct
layers. Do not download the unrestricted offer population for local filtering.
Forward `MapView` lifecycle events and release native resources when the
destination leaves composition.

### Profiles, safety and avatars

Load the established protected member profile and accommodation offer. Display
available identity, location, languages, circles, hosting, last-seen and reply
statistics without inferring private data. Use the authenticated avatar
endpoint and remove the Trustroots cookie before following any cross-origin
redirect.

Reporting uses `/api/support`; blocking and unblocking use the existing
blocked-member route. Confirm relationship changes and keep reporting and
blocking independent. Do not offer messaging to the signed-in member or a
blocked member.

### Messaging and experiences

Load the complete paginated inbox, support local filtering, open native
conversation history and send through the established message endpoint. Mark
read messages through the existing route. Keep the composer keyboard-aware and
preserve a draft during transient configuration changes.

Surface the established conversation-experience state and allow the member to
share an experience through the native form. Do not invent a separate Android
thread or experience representation.

### Bounded browser and Nostr identity

Keep password recovery, confirmation and explicitly deferred Trustroots pages
inside the bounded WebView. Allow only approved Trustroots HTTPS origins,
reject mixed content, file/content access, unsafe schemes and untrusted
subframes, and require confirmation before external navigation.

Expose NIP-07 only through origin-scoped WebView messaging. Keep the private
key encrypted by a Keystore-backed key, never return it to JavaScript and
require native permission decisions for signing or encryption operations.
Support the same operation set and project-origin policy as iOS. This bridge is
not an authentication mechanism.

### Protected read-only cache

Cache successful authenticated GET responses by normalised server, account and
request. Protect cached private payloads with Keystore-backed authenticated
encryption. A transport failure may use a prior decoded response, but HTTP
authorisation and validation failures must not be hidden. Show a persistent
plain-language offline warning whenever saved data is used.

Mutations remain unavailable offline. Clear the active account namespace on
sign-out or invalid session and never expose it to a subsequent account.

### First-party analytics and privacy

Send aggregate native screen pageviews to the existing self-hosted Umami
endpoint with Android-prefixed paths and a dedicated native-app identity.
Do not send username, email, session cookie, advertising identifier or another
persistent device identifier. Do not add advertising SDKs.

Request location and photo access only after the member invokes the
corresponding feature. Document network, location, photo, WebView, storage and
analytics behaviour in the internal-testing release metadata.

## Risks / Trade-offs

- [Existing JSON responses change] → Pin consumed fields in Android contract
  tests and tolerate only genuinely optional fields.
- [Native map increases APK size or lifecycle risk] → Keep one maintained map
  dependency, forward lifecycle explicitly and exercise repeated navigation.
- [Cached data leaks across accounts] → Namespace and encrypt cache entries and
  clear the active namespace on sign-out.
- [WebView bridge exposes a private key] → Use origin-scoped messaging, native
  permission checks and Keystore-backed encryption; never inject the secret.
- [Android drifts from iOS] → Classify material changes through the shared
  parity contract and compare representative journey states.
- [MVP scope delays all testing] → Ship coherent verified slices to internal
  testing while keeping unfinished journeys clearly tracked.

## Migration Plan

1. Complete and verify each native journey against staging or the configured
   production-compatible API.
2. Run unit, lint and Compose UI suites plus representative device checks.
3. Publish an internal-testing build with privacy and support documentation.
4. Expand testing before a public Play release.
5. If rollback is needed, withdraw the Android build; existing browser and iOS
   access remain unchanged.

No database or server migration is required.

## Open Questions

- Which Android API levels and device-size matrix should be guaranteed for the
  first public release beyond the current `minSdk`?
- Which production map style and tile service should replace public demo tiles
  before external distribution?
- Should FCM registration use a separately versioned native device-session
  contract when notification work begins?
