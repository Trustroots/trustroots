## Why

The Android screenshot review in #3181 identifies lost state on rotation and
avoidable friction when discovering circles, searching, reading profiles,
messaging and editing. Native controls should make these journeys clear and
protect work in progress.

## What Changes

- Preserve the active Compose hierarchy during rotation and window resizing.
- Use labelled Material bottom navigation with a selected state and unread badge.
- Keep map search visible, choose search mode through a menu, offer debounced
  place suggestions, and toggle compact filters without a redundant back action.
- Show map-area statistics at the bottom and compact clickable host cards with
  avatars, usernames, shared circles, available taglines and clear hosting status.
- Introduce About, Contacts and Experiences profile tabs below the header, with
  swipe navigation, keeping hosting information in About.
- Improve circle discovery copy and membership states, member-search empty
  states, message bubbles and the composer.
- Use native back icons and sticky form actions; confirm before losing edited
  profile or other form values, including via primary navigation.

## Impact

Affected: `apps/android` UI, activity configuration and native journey tests.
No API changes, data migration or web/iOS changes. Existing member API fields
remain the source of profile information; gender and age are not available in
the native profile contract and are not added by this UI change. Compose
Multiplatform remains a separate architectural investigation. Native device
journey tests provide end-to-end coverage for these Android-only features.
