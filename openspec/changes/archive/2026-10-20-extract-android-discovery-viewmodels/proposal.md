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
  coordinates and zoom, and safe community-note state with the stable Search
  root entry that owns the map. Load host detail from its own child route.
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
- Keep HostMap and MemberSearch state owned by the actual decorated
  `MemberTabVisit(Destination.Search, visitID)` entry. Future Search child
  routes remain beneath that retained owner; do not add a synthetic
  always-single-entry wrapper or substitute another store.

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
  changes. The current decorated top-level Search visit is the HostMap and
  MemberSearch ViewModel owner. A later Search child-route migration must
  acquire those models in the SearchHub composition above its child NavDisplay
  so they survive Map/Members/Profile route replacement.
