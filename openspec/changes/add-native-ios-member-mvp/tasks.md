## 1. Existing API integration and security

- [x] 1.1 Use the existing `/api/auth/signin` and `/api/auth/signout` session
      flow without adding native-specific server routes.
- [x] 1.2 Store the signed session cookie in the iOS Keychain and attach it only
      to requests for the configured Trustroots API origin.
- [x] 1.3 Use existing policy-protected profile, circle, offer, contact,
      experience, message, account and support routes.
- [x] 1.4 Keep the native URL session isolated from shared browser cookie
      storage so the allowlisted website fallback has an independent session.

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

- [ ] 4.1 Retain the existing server route tests for authentication,
      authorisation, visibility, validation and pagination.
- [x] 4.2 Add iOS API-client contract tests for existing route paths, session
      cookie handling, error handling and model decoding.
- [ ] 4.3 Add XCUITests for sign-in, profile update, circle membership, offer
      discovery, composing/reading a message, browser routing, and NIP-07
      permission decisions.
- [ ] 4.4 Add further end-to-end native journey coverage where simulator
      automation provides value beyond the existing server and browser suites.
- [ ] 4.5 Validate the OpenSpec change and run the relevant server, iOS, and
      end-to-end test suites.

## 5. Follow-on shared Nostr key (separate coordinated release)

- [ ] 5.1 Propose and implement a Nostroots Expo app migration from its private
      Keychain item to a shared Keychain Access Group.
- [ ] 5.2 Enable the same access group in the Trustroots iOS app only after
      both applications use the same Apple Developer Team.
- [ ] 5.3 Test upgrade, fallback, key visibility, and revocation behaviour in
      both applications before enabling shared-key use.
