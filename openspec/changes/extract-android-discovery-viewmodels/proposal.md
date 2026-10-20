## Why

`HostMapScreen` and `MemberSearchScreen` currently keep their API requests,
filters, search results, asynchronous work and failures in Compose-local state.
That state can be lost when a member changes Search mode, opens a nested
destination, switches tabs or recreates the Activity. Moving each screen's
business state into a Navigation 3 entry-scoped ViewModel will preserve the
member's active discovery work while the owning Search visit remains on the
back stack, and will give requests and authentication failures a testable
owner.

## What Changes

- Give HostMap and MemberSearch separate ViewModels with immutable state,
  explicit events and injectable repository boundaries for API and place
  lookup operations.
- Keep map filters, visible-area offers, place query/suggestions, map camera
  coordinates and zoom, host context, and community-note state with the Search
  visit that owns the map.
- Keep member query, submitted results, loading/error state and search status
  with the Search visit that owns member search. Keep list scroll position in
  the owning Navigation 3 saveable-state entry.
- Cancel or ignore obsolete requests, acknowledge session-invalidation events
  once, and clear account-owned work when the authenticated shell is removed.
- Preserve the existing Search tab behaviour: switching modes and temporarily
  leaving Search retains its state; explicitly reselecting Search resets to
  map mode, clears both screens' prior search/filter state and starts fresh
  map data loading without adding a shell history visit.
- Keep sessions and cookies as in-memory request dependencies only. They are
  never included in immutable UI state, Navigation 3 keys, saved-state values
  or persistent storage.

## Capabilities

### Modified Capabilities

- `native-android-member-app`: specify Navigation 3-owned discovery state,
  retained Search behaviour, same-tab reset, stale-request handling and
  credential-safe state ownership.

## Impact

- Android discovery state and rendering under `apps/android/app/src/main/java/org/trustroots/android/ui`,
  including `HostMapScreen.kt`, `SearchHubScreen.kt` and
  `membersearch/MemberSearchScreen.kt`.
- New HostMap and MemberSearch ViewModels, injectable repository adapters,
  deterministic unit tests and Android instrumentation journeys.
- No API or server changes, persistent data migration, or web/iOS behaviour
  changes. The Search `MemberTabVisit` already provides a Navigation 3 entry
  store for this slice. A later nested Navigation 3 migration may refine route
  ownership, but this proposal does not depend on an unlanded child-entry API.
