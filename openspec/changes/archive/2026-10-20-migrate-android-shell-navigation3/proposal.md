## Why

The Android member shell currently owns tab selection and Back history through
several independent Compose state values. This makes top-level navigation hard
to restore consistently after activity recreation and leaves the shell's
history rules implicit. A Navigation 3 back stack gives the shell one explicit,
saveable source of truth while preserving the established member journeys.

## What Changes

- Migrate the authenticated Android member shell's top-level Circles, Search,
  Messages and Profile tabs to Navigation 3's `NavDisplay` and back stack.
- Use serialisable tab-visit keys containing only a safe destination and a
  navigation-entry identifier; session credentials and member data remain in
  the live authenticated parent and never enter navigation keys or saved
  navigation state.
- Preserve existing tab-origin history, same-tab reset actions, unread-message
  notification routing, analytics screen tracking and form leave guards.
- Keep menu pages, browser routes, profile detail routes and other nested flows
  on their existing state model for a later migration slice.

## Capabilities

### Modified Capabilities

- `native-android-member-app`: specify Navigation 3 ownership of top-level
  member navigation and its Back, restoration and security behaviour.

## Impact

- Android app navigation code and its Compose instrumentation coverage.
- Android Gradle dependencies for Navigation 3 runtime and UI. Use stable
  Navigation 3 version 1.2.0, matching the existing Kotlin 2.3.21, Compose BOM
  2026.06.00 and Lifecycle 2.10.0 stack. Add the matching Kotlin serialization
  plugin and runtime for saveable keys, plus Lifecycle's 2.10.0 Navigation 3
  ViewModel decorator; do not introduce alpha APIs or bump unrelated toolchain
  versions.
- No server, web, iOS, session-storage or wire-format changes. Existing saved
  state is process-local Android state; no persistent data migration is needed.
