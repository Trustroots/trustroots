## 1. API foundation and security

- [ ] 1.1 Define and version the mobile API schemas, error model, pagination,
      and compatibility policy.
- [ ] 1.2 Add mobile registration, sign-in, access-token refresh, sign-out,
      session listing/revocation, and server-side token rotation/revocation.
- [ ] 1.3 Add authenticated mobile representations and routes for current
      member/profile/photo, circles/membership, offers/search, messaging,
      contacts, experiences, account settings and support.
- [ ] 1.3.1 Migrate every native iOS member-data request from legacy `/api/*`
      routes to an equivalent purpose-built `/api/mobile/v0` bearer route;
      do not retain cookie-backed fallbacks for native resources.
- [ ] 1.3.2 Deliver the migration in independently testable resource groups:
      circles and offers; contacts and experiences; messages; then account,
      profile mutations and support.
- [ ] 1.4 Add required indexes and a safe migration for mobile sessions.
- [ ] 1.5 Prove that mobile sign-in does not issue a browser-session cookie and
      that deploying the additive mobile routes leaves existing browser auth
      and rendered website behaviour unchanged.

## 2. Native iOS application

- [ ] 2.1 Create the SwiftUI Xcode project, build configuration, networking
      layer, Keychain credential store, and application navigation shell.
- [ ] 2.2 Implement registration, sign-in, and sign-out, with a clear route to
      the in-app browser for website account confirmation and password recovery.
- [ ] 2.3 Implement profile viewing, editing, and supported profile-photo
      selection/upload.
- [ ] 2.4 Implement circle browsing, circle details, and membership changes.
- [ ] 2.5 Implement MapKit offer search, filtering, detail presentation, and
      hosting/meeting offer management.
- [ ] 2.5.1 Ensure filter changes supersede in-flight map searches and that
      result labels reflect the active host/meetup selection.
- [ ] 2.5.2 Add an explicit, local-only current-location map control and the
      corresponding permission explanation; defer location sharing to a separate
      proposal.
- [x] 2.5.3 Enable Meetups by default and add the website-compatible,
      validator-approved Community Notes via Nostroots map layer.
- [ ] 2.6 Implement inbox, paginated conversation history, sending replies,
      unread state, and protected/empty/error states.
- [ ] 2.6.1 Add native local filtering for loaded conversations and circles.
- [x] 2.6.2 Show an existing experience relationship from a conversation and
      offer a native experience form after a meaningful message exchange.
- [ ] 2.7 Implement the allowlisted `WKWebView` fallback for deferred website
      routes, browser history, and external-link handling.
- [ ] 2.8 Implement a fixed-origin, permissioned NIP-07 bridge that keeps the
      private key in Keychain; do not make shared Nostroots-key access a
      TestFlight dependency.
- [ ] 2.8.1 Provide native create/import/remove controls for the app-local
      Nostr key and clear remembered browser permissions whenever it changes.
- [ ] 2.8.2 Pin a compatible Nostr SDK release and cover supported NIP-07
      operations and origin-permission decisions with iOS tests.
- [x] 2.9 Add an account/server-scoped protected cache for authenticated GET
      responses and a persistent warning whenever cached data is being shown.

## 3. TestFlight readiness

- [ ] 3.1 Add privacy manifest, App Store metadata, crash reporting, and
      TestFlight release documentation.

## 4. Verification

- [ ] 4.1 Add server unit and integration tests for authentication lifecycle,
      authorisation parity, endpoint schemas, visibility, validation, pagination,
      revocation, and APNs token handling.
- [ ] 4.2 Add iOS unit and API-client tests for Keychain storage, token
      refresh, error handling, model decoding, and feature view models.
- [ ] 4.3 Add XCUITests for sign-in, profile update, circle membership, offer
      discovery, composing/reading a message, browser routing, and NIP-07
      permission decisions.
- [ ] 4.4 Add an end-to-end server/client contract suite covering the native
      MVP journeys without weakening existing browser coverage.
- [ ] 4.5 Validate the OpenSpec change and run the relevant server, iOS, and
      end-to-end test suites.

## 5. Follow-on shared Nostr key (separate coordinated release)

- [ ] 5.1 Propose and implement a Nostroots Expo app migration from its private
      Keychain item to a shared Keychain Access Group.
- [ ] 5.2 Enable the same access group in the Trustroots iOS app only after
      both applications use the same Apple Developer Team.
- [ ] 5.3 Test upgrade, fallback, key visibility, and revocation behaviour in
      both applications before enabling shared-key use.
