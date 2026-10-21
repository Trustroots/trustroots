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

`MemberShell` renders Search under the decorated
`MemberTabVisit(Destination.Search, visitID)` entry. `SearchHubScreen` obtains
that owner through `LocalViewModelStoreOwner` and acquires the HostMap and
MemberSearch ViewModels before composing its child Navigation 3 `NavDisplay`.
The Search visit remains the stable owner when a mode, HostDetail or profile
route is current. Switching to Members hides the map UI; HostDetail and profile
overlays keep the map scene composed beneath them. No synthetic wrapper entry
or separate store is needed.

## Goals and non-goals

**Goals:**

- Keep HostMap and MemberSearch business state in two distinct screen
  ViewModels, each obtained from the stable Search `MemberTabVisit`'s
  Navigation 3-owned ViewModel store.
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

### Use two ViewModels under the stable Search-root entry

Create `HostMapViewModel` and `MemberSearchViewModel`, each exposed as
`StateFlow` of an immutable data class and each accepting a sealed event type.
Use a factory/repository seam and `LocalViewModelStoreOwner.current` from the
real decorated `MemberTabVisit(Destination.Search, visitID)` entry. Acquire the
model in `SearchHubScreen` before any nested NavDisplay and pass it into map
content. Do not scope it to a replaceable Map/Members/Profile route, synthetic
always-single-entry wrapper, Activity, application or static store. Future
route integration must retain the actual Search tab visit and reuse its model
when Map content is disposed and restored.

The ViewModel remains alive while the Search visit is retained off-screen and
is cleared when that Search root entry is removed on tab reset, sign-out or
session invalidation. Switching between Map and Members and pushing a child
route must not clear it. Switching to Members closes the map-only note source;
HostDetail and profile overlays above the map keep the map scene and source
active. The root model is shared only within that one Search
visit; a separately revisited Search tab gets a separate child stack and
separate entry store.

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

`HostMapUiState` contains visible-area offers; loading and typed failure state;
the host/meet, seen-month, circle and language filters; circle options; place
query and value-type suggestions; a value-type viewport snapshot of latitude,
longitude and zoom; and received/visible community-note data and note-source
status. It does not contain a `MapView`, `Address`, `Geocoder`, selected
`HostOffer`, `MemberProfile`, host circle memberships, `Context`, or translated
text. Those selected host/profile data belong to the separate HostDetail and
MemberProfile child entries, whose route keys contain only stable identifiers.
Events cover filter changes, measured visible bounds and camera changes, place
query/suggestions/submission/selection, retry/reset, map visibility, note-source
activity and session-event acknowledgement. Compose retains transient menus,
focus, keyboard, open note panels, map overlays and card layout. Keep current
defaults: centre latitude 38.7223, longitude -9.1393, zoom 6.5, hosts
enabled, meet disabled, six months, and empty circle/language filters. Keep
selected language codes as codes and resolve their labels from locale
resources at render time.

Inject narrow repositories for map offers and circles, visible Nostroots
authors, and place lookup. Host detail/profile requests are not map repository
operations: the HostDetail/MemberProfile child routes load those records from
their own owners while Search-root map results and camera state remain intact.
Production adapters may hold the current `MemberSession` in memory while
making API calls; no credential is copied into state or a route. The place
lookup adapter may use the application context and Android `Geocoder` on an IO
dispatcher, but it returns only a value such as `PlaceSuggestion(label,
latitude, longitude)`. Neither `Context`, `Address` nor `Geocoder` is retained
by ViewModel state. This flow is text place lookup only: it does not request
fine/coarse device-location permission or read the device's current location.

Keep `NostrootsNotesClient` behind an injectable source. Start it while the
Search-root entry is started, Map is the selected mode, and `includeMeet` is
enabled; close it when the entry stops, Map mode is hidden by Members, or the
filter is disabled, and close it again safely when the entry ViewModel is
cleared. HostDetail and profile overlays keep the map scene composed, so the
live source remains connected while those overlays are shown. Retain received
safe note values while Map is hidden by Members, then reconnect and continue
filtering when Map becomes active again. Disabling Meet preserves the current
behaviour of clearing received and visible note values. Use the
actual Navigation 3 entry lifecycle plus a map-visible event from its screen
to drive active/inactive source work; do not tie it to the Activity lifetime
or to mere ViewModel retention. This also handles a Search root that remains
started while a mode-specific child is on top. Ignore late note/source
callbacks after stop, reset, account removal or replacement by checking a
generation token.

### Coordinate async work and one-shot authentication handling

Run screen requests in `viewModelScope`, preserve coroutine cancellation, and
check request generations before publishing results. Query edits cancel an
older member lookup; map filter or viewport changes retain the current 550 ms
debounce and cancel the prior visible-area request. The request fingerprint
contains clamped bounds, selected offer types, sorted circle IDs, seen-month
filter and sorted language codes. If Activity recreation or returning to the
same retained Map entry produces an identical successful fingerprint, reuse
its offers instead of issuing a duplicate request. An explicit reset or retry
may force a fresh request. Place suggestions retain the 400 ms delay, trimmed
three-character threshold and three-result limit; suggestion and submitted
place lookup use separate generations so an older query cannot restore
suggestions, move the camera or replace a newer error. Retapping the submitted
search remains its retry action. Loading flags are associated with the active
request so an obsolete completion cannot clear a newer request's progress.

Keep current map-search semantics: clamp API bounds to latitude [-90, 90] and
longitude [-180, 180]; when neither offer type is selected, cancel the request,
clear offers and stop loading without issuing an API call; fetch circles
lazily when the filter menu opens and retry on a later open if no list was
obtained; and trigger visible-area search after the first measured map, filter
changes, camera movement, selected place or explicit Search reset. Failure
messages retain nonblank server text and API failure kind in `UiFailure`, with
the existing XML fallback resolved at render time. Auth failures from map
offers, circles or visible-author lookups produce one identified pending
invalidation event for the active Search entry; the shell acknowledges it and
removal of that entry cancels remaining work.

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
state, closes any active HostDetail/Profile descendants, and cancels member
search. The reset adds no top-level history visit.

The shell increments `searchResetGeneration` and records `searchResetVisitID`
for active-tab reselection while keeping the same `MemberTabVisit`.
`SearchHubScreen` applies the token only when it matches the owner visit and
sends an identified `Reset` event to both discovery models. The map model
restores its existing default coordinates, zoom 6.5 and filter defaults,
clears place query/suggestions and prior offers, cancels obsolete work, then
forces one new visible-area request after the new map is measured. Deduplicate
a generation after Activity recreation and preserve the guarantee that another
retained Search visit is not reset. The child Navigation 3 stack also returns
its routes to the map root without appending a top-level visit.

### Keep navigation and Android rendering at the boundary

The map renderer observes `HostMapUiState`, reports camera and measured-bounds
values, and applies the restored viewport to a newly created `MapView`; it does
not own request generations or API result filtering. A selected offer pushes a
`HostDetailVisit`; its decorated entry's `HostDetailViewModel` owns canonical
offer, profile and membership data. Map note panels, filters, suggestion
menus, keyboard/focus and marker clustering stay as transient presentation
state and consume Back before a route pop. When a profile or HostDetail route
hides map UI, the Search tab visit keeps HostMap state while its visibility
event pauses map-only work and the live notes source. Do not place loaded
models, API errors, search text, member session, cookies or map objects in
route keys.

### Validate ownership with real lifecycle journeys

Use fake repositories for ViewModel unit tests and Android Compose journeys
for shell integration. `Navigation3MemberShellJourneyTest` launches the real
authenticated shell and verifies Search mode/profile Back, map
filter/camera/query retention over `ActivityScenario.recreate()`,
HostDetail/profile restoration and deduplicated requests, Search reset, and
Search/map session expiry with account replacement. `HostMapMarkerJourneyTest`
verifies that the note source remains alive through HostDetail and profile
routes; HostMap unit tests cover stop/reconnect generations. Use anonymous
fixtures; repositories may retain the live session only in memory, while
Navigation 3 keys contain safe identifiers only.

## Ownership decisions and remaining HostMap choices

- **Search mode ViewModel lifetime:** `SearchHubScreen` resolves both models
  under the decorated Search `MemberTabVisit(Destination.Search, visitID)`.
  Acquire them before child `NavDisplay` composition and pass the instances
  into whichever screen is current. Do not add a synthetic wrapper entry or
  move ownership to an Activity/global store.
- **Same-tab reset mechanics:** the shell identifies reselection by
  `MemberTabVisit.visitID` and generation. `SearchHubScreen` applies only the
  token targeted to that visit and sends one reset event to both models; a
  child NavDisplay also resets routes to Map. It must not append
  a top-level visit or reset another retained Search visit.
- **Host card ownership:** marker selection pushes `HostDetailVisit` with its
  canonical offer ID and type. Its decorated entry owns offer, profile and
  membership loads in `HostDetailViewModel`; the Search-root HostMapViewModel
  retains map state and results. Profile navigation is a child of HostDetail.
- **Map activity and notes:** observe both the Search visit lifecycle and
  explicit map visibility. The
  `MapView` is an Activity-bound UI object, recreated after Activity recreation
  and restored from the model's value viewport. Never keep it in a ViewModel.
  The live notes connection closes while the Search-root route is inactive or
  Meet is disabled; received note values survive temporary route/mode
  invisibility but are cleared when Meet itself is disabled. Resume opens one
  source and rejects callbacks from older source generations. This preserves
  the current filter-off clear behaviour while retaining notes across
  mode/child-route switches as required by the Search visit.
- **Integrated route ownership:** retain the models acquired from the actual
  Search `MemberTabVisit` in `SearchHubScreen` above its child NavDisplay.
  Profile/detail routes may dispose map content but do not replace its owner.
  Visibility events pause map requests and live notes while another mode/route
  is shown and resume without losing source state.
