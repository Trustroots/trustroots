## 1. OpenSpec and foundation links

- [x] 1.1 Add proposal, design and delta specs for phone-web Android parity.
- [x] 1.2 Cross-link from `add-native-android-member-mvp` to this change.

## 2. Phase 1 — Menu parity

- [x] 2.1 Rebuild Menu to match phone web `/navigation` member actions and
      Info and support grouping (British labels for new copy).
- [x] 2.2 Keep Sign out on Account only (not on Menu).
- [x] 2.3 Wire Host to allowlisted WebView; Nostroots and other Trustroots
      HTTPS info links via embedded browser; external confirmation for
      non-allowlisted hosts.
- [x] 2.4 Deep-link Find people to Search → Members; Circles to Circles
      destination; profile and edit profile to native profile screens.
- [x] 2.5 Add a thin native Contacts list using existing contacts API.
- [x] 2.6 Update Menu Compose tests and run Android unit tests and lint.

## 3. Phase 2 — Profile chrome

- [x] 3.1 Add sticky profile actions equivalent to phone web top small nav.
- [x] 3.2 Add section navigation equivalent to phone web bottom profile tabs.

## 4. Phase 3 — Messaging

- [x] 4.1 Multiline compose and draft persistence aligned with phone web.
- [x] 4.2 Hosting QuickReply where applicable.
- [x] 4.3 Real unread indicator (not a fixed badge).

## 5. Phase 4 — Search

- [x] 5.1 Filters / place-search patterns closer to mobile `SearchPage`.

## 6. Phase 5 — Host, experiences and remaining account

- [ ] 6.1 Native Host offer management replacing Menu WebView Host.
- [ ] 6.2 Native experiences and remaining account settings.

## 7. Verification

- [ ] 7.1 Validate this OpenSpec change after each phase that edits specs or
      tasks.
- [ ] 7.2 Keep Android lint and unit tests green for landed phases.

Phase 1 note: OpenSpec validated and `./gradlew testDebugUnitTest lintDebug assembleDebug` succeeded after Menu landing.
