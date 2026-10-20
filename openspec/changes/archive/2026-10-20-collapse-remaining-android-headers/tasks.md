# Tasks

## Baseline

- [x] Add anonymous-fixture Compose journeys for the Profile destination,
      Contacts, Account, own profile, and another member's profile.
- [x] Capture expanded and scrolled screenshots and record header/action/tab
      bounds before production edits.
- [x] Run the baseline journeys on the supported Android test target and
      retain the screenshot artifacts for comparison.

## Implementation

- [x] Validate nested-scroll and collapsing app-bar API availability with the
      pinned Compose BOM (2026.06.00); do not change the BOM.
- [x] Implement compacting headers for the Profile destination, Contacts and
      Account while preserving content order, Back behaviour, form state, and
      insets.
- [x] Implement a shared collapsing profile frame for own and member profiles;
      preserve artwork behind actions and tabs, action routing, overflow, and
      the fixed tab row outside the pager.
- [x] Extend native UI journeys to assert expanded/scrolled states, preserved
      actions, tab/pager synchronisation, and inset-safe bounds.
- [x] Update the living `native-android-member-app` specification and archive
      this change after implementation and verification.

## Verification

- [x] Run targeted Android journeys on the required Android test target and
      compare screenshots with the captured baseline.
- [x] Run Android lint and unit tests after UI work is complete.
