## 1. Android foundation

- [x] 1.1 Create the Gradle, Kotlin and Jetpack Compose application project.
- [x] 1.2 Add build-time API server configuration and Trustroots design tokens.
- [x] 1.3 Add the existing API client, session model and Keystore-backed cookie
      storage.
- [x] 1.4 Add native sign-in and application navigation shells.

## 2. Native member MVP

- [x] 2.1 Implement profile viewing and editing.
- [x] 2.2 Implement circle browsing, details and membership changes.
- [x] 2.3 Implement native map search and host details.
- [x] 2.4 Implement inboxes, conversations and message sending.
- [ ] 2.5 Implement native experiences and account settings.
- [x] 2.6 Add local filters and account-scoped offline read caching.
- [x] 2.6.1 Cache selected map, message and profile reads by account and server;
      show a saved-data warning and cache a limited set of circle images.
- [x] 2.6.2 Add local filters for loaded circles and conversations.
- [x] 2.7 Add native member search and profile viewing.

## 3. Browser fallback and identity

- [x] 3.1 Add the allowlisted embedded browser for deferred Trustroots flows.
- [ ] 3.2 Add the Android NIP-07 permission and signing bridge without exposing
      private keys to page JavaScript.

## 4. Verification and distribution

- [x] 4.1 Add API-client contract and session-storage unit tests.
- [ ] 4.2 Add Compose UI tests for the core member journeys (member search,
      profile viewing, circles, map loading, messaging and account responsiveness
      covered; other journeys remain).
- [x] 4.3 Validate the OpenSpec change and run Android lint and tests.
- [ ] 4.4 Add internal-testing release documentation and privacy metadata.

## 5. Follow-on notifications

- [ ] 5.1 Add Firebase Cloud Messaging token registration and native message
      notifications after the core MVP is usable.
