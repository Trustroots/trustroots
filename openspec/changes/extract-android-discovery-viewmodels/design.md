## Context

`MemberShell` renders Search in a Navigation 3 `MemberTabVisit` with the
saveable-state and ViewModel-store entry decorators. `SearchHubScreen` currently
switches between `HostMapScreen` and `MemberSearchScreen`; each screen creates
its own local state and coroutine work. The map additionally owns viewport
search debounce and cancellation, place geocoding, filters, circles, selected
host/profile context and a live Nostroots notes connection. Member search
holds a submitted query, result list, request revision, loading state and
errors. The app already has a ViewModel pattern in `SignInViewModel`; a sibling
Circles change provides a closer example of an injectable repository, immutable
state, explicit events and an entry-scoped store.

The sibling `complete-android-nested-navigation3` proposal describes per-tab
child stacks, route-owned state and same-tab reset. Its current implementation
slice changes menu and browser routes; Search remains under the existing
`MemberTabVisit` entry. `NavDisplay` already applies
`rememberViewModelStoreNavEntryDecorator`, and `SearchHubScreen` can obtain its
current entry owner through `LocalViewModelStoreOwner`. This change uses that
known owner and does not depend on a future child-entry API.

## Goals and non-goals

**Goals:**

- Keep HostMap and MemberSearch business state in two distinct screen
  ViewModels, each obtained from the active Search visit's Navigation 3-owned
  ViewModel store.
- Retain each mode's filters, query, results, camera and pending requests while
  that Search visit is retained, including while the other mode or a child
  destination is visible and through Activity recreation.
- Reset both modes when the member explicitly reselects the active Search tab,
  with no extra top-level visit and fresh map results.
- Make repository work deterministic in unit tests and ensure stale responses
  and old-account work cannot update the active state.
- Keep Android `MapView`, Compose controls, focus/keyboard, rendering and
  navigation callbacks in the UI layer.

**Non-goals:**

- Changing API payloads, map/search defaults, filtering semantics, layouts,
  copy, map markers, host cards, geocoding provider or result ordering.
- Persisting member sessions, cookies, API responses or discovery history to
  disk. ViewModel state is retained in the live Navigation 3 entry store; after
  process death the safe route may reopen and issue fresh requests.
- Migrating Navigation 3 routes or Back dispatch in this change. Those belong
  to the sibling issue 3234 navigation migration.
- Moving stateless map rendering helpers, profile-screen state or the global
  shell's unread-message polling into these ViewModels.

## Decisions

### Use two ViewModels under the Search visit owner

Create `HostMapViewModel` and `MemberSearchViewModel`, each exposed as
`StateFlow` of an immutable data class and each accepting a sealed event type.
Use a factory/repository seam and the current
`LocalViewModelStoreOwner.current` from the decorated Search
`MemberTabVisit`; do not use an Activity-wide, application-wide or static
store. Both models belong to the Search visit because mode changes must
preserve the state of the screen being left. If a later navigation change adds
a Search root entry, keep it as their stable owner and do not let a temporary
child destination own or clear the discovery state.

Keep `SearchHubScreen` responsible for composing the active screen and
forwarding the explicit Search reset operation. It may read both models from
the same owning entry store. A mode switch only changes the visible child; it
does not create a fresh model. Route pushes for member profiles or host details
retain the Search root and its model stores.

### Define immutable state and events around existing behaviour

`MemberSearchUiState` contains query text, search-in-progress and searched
flags, result profiles, displayable error and a uniquely identified pending
session-invalidation event. Events cover query changes, submit, retry/reset,
and delivery acknowledgement. Preserve the current minimum three-character
submission rule, clear-on-edit behaviour, error copy, empty-result display and
profile-open callback. Keep the result list's scroll position in the
Navigation 3 entry's saveable Compose state, keyed to this screen entry.

`HostMapUiState` contains visible-area offers; loading and error state; the
host/meet, seen-month, circle and language filters; circle options; place query
and suggestions; a value-type viewport snapshot of latitude, longitude and
zoom; selected host/profile resource identifiers and fetched host context;
circle memberships; and community-note state. The viewport is a simple
immutable value and never contains a `MapView`. Events cover filter changes,
visible bounds and camera changes, place query/suggestions/submission,
selected result/resource, retry/reset, note-source activity and session-event
acknowledgement. Compose retains transient menus, focus, keyboard, map overlays
and card layout. Keep current defaults (Porto, zoom 6.5, hosts enabled, meet
disabled, six months, and empty circle/language filters).

Inject narrow repositories for member lookup, map offers/circles/host context,
visible Nostroots authors, and place lookup. Production adapters may hold the
current `MemberSession` in memory while making API calls. Place lookup should
return a small value type (label and coordinates), keeping Android
`Address`/`Geocoder` objects out of ViewModel state. Keep the existing
`NostrootsNotesClient` behind an injectable source; start it while the map
entry is active and close/cancel it when that entry is removed. If the map is
temporarily not the visible mode, suspend the source and resume it on return
without clearing retained notes or filters.

### Coordinate async work and one-shot authentication handling

Run screen requests in `viewModelScope`, preserve coroutine cancellation, and
check request generations before publishing results. Query edits cancel an
older member lookup; map filter or viewport changes debounce/cancel the prior
visible-area request. Place suggestions and submitted place lookups use
separate generations so an older query cannot restore suggestions, move the
camera or replace a newer error. Retrying clears the prior error but retains
the current query/filter/camera values. Loading flags are associated with the
active request so an obsolete completion cannot clear a newer request's
progress.

Represent authentication failures as an identified pending event in state.
The Compose owner delivers the existing parent `onSessionInvalidated` callback
and acknowledges the event exactly once. Non-authentication failures use the
existing user-facing messages and remain retryable where the current UI offers
retry. When sign-out or session invalidation removes `MemberShell`, Navigation
3 clears the Search entry store; `onCleared` cancels requests and closes any
map note source. A later account receives new models and empty discovery state.

The repository/session dependency is held only as an in-memory constructor
dependency to the model or adapter. Do not include cookies, `MemberSession`,
API clients or credentials in `HostMapUiState`, `MemberSearchUiState`,
`SavedStateHandle`, Navigation 3 keys or persistent state. Safe route
identifiers remain the navigation layer's concern.

### Reset Search explicitly on same-tab reselection

Preserve the existing user-visible reset: reselecting Search returns to Hosts
map, restores the map's default camera and filters, clears place text and
suggestions, clears selected host/profile and map results, then performs a new
visible-area search. It also clears member query, results, searched/error
state, and cancels member search. The reset adds no top-level history visit.

The current shell increments `searchNavigationID` and remounts Search content
for an active-tab reselection while keeping the same `MemberTabVisit`. Because
that reuses the entry's ViewModel store, pass the reset generation to
`SearchHubScreen` and dispatch an identified `Reset` event to the MemberSearch
model even when map mode is visible. Pair the generation with the active
`MemberTabVisit.visitID`; only that visit consumes the event, so returning to a
different retained Search visit does not reset its state. Deduplicate a
generation when its visit returns after Back or Activity recreation. Persist
the generation and target visit ID with saveable shell state so rotation does
not replay a reset or collide with an already-consumed token. The map model will
use the same explicit reset contract in its later implementation slice.

### Keep navigation and Android rendering at the boundary

This change supplies state and event owners for the existing screen APIs. The
nested Navigation 3 migration decides how a member-profile or host-detail
identifier is placed in a route and who dispatches Back. Use stable resource
identifiers in route keys only. Keep loaded models, API errors, search text,
member session and cookies out of route keys. The map renderer observes
`HostMapUiState`, reports viewport changes, and applies state to its
`MapView`; it does not own request generations or API result filtering.

### Validate ownership with real lifecycle journeys

Use fake repositories for ViewModel unit tests and the existing Android
Compose journey infrastructure for shell tests. Exercise a real
`ActivityScenario.recreate()` with the authenticated Search visit open and
assert that both VMs retain the expected safe UI state without repeating
successful reads. Also test leaving Search and returning, switching modes,
opening/backing from nested results, same-tab reselection, sign-out/session
invalidation and reopening under another account. Use an anonymous session
cookie sentinel and verify state/navigation saveables do not contain it; the
models may retain the live session only through their in-memory request
adapter.

## Ownership decisions and remaining HostMap choices

- **Search mode ViewModel lifetime:** confirmed: scope both distinct models to
  the current Search `MemberTabVisit` entry so switching modes and temporarily
  leaving Search preserves state. If a later navigation change adds a stable
  Search root entry, use that owner instead of a temporary child route.
- **Same-tab reset mechanics:** confirmed for the current shell: dispatch a
  generation-identified event targeted to the current `MemberTabVisit`; do not
  append a history visit or reset another retained Search visit. The HostMap
  implementation will receive its matching event in the later slice.
- **Host detail ownership:** recommended for the later HostMap slice: map
  selection and fetched host context remain in the Search-root HostMap model
  while any route key carries only a stable offer ID. A future route-owned
  detail model should be a separate decision and keep the map model alive
  beneath it.
- **Nostroots note-source activity:** recommended: close the live note source
  when Search is not active, retain already received notes in the map model for
  the Search visit, and reconnect when the map returns. Confirm the source's
  reconnect semantics before implementation.
