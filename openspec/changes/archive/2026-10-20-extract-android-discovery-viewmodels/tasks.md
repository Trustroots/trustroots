## 1. Resolve Navigation 3 ownership

- [x] 1.1 Confirm the current Search `MemberTabVisit` owner through
      `LocalViewModelStoreOwner` and the existing ViewModel-store entry
      decorator.
- [x] 1.2 Add an identified reset generation scoped to the active Search visit
      so same-tab reset clears member-search state without adding a history
      visit or resetting a different retained Search visit.
- [x] 1.3 Confirm the `HostDetailVisit` entry owns its canonical offer,
      profile and membership loads, while the decorated Search visit retains
      map state and controls the note-source stop/reconnect lifecycle.
- [x] 1.4 Confirm that the actual decorated Search
      `MemberTabVisit(Destination.Search, visitID)` is the screen-state owner;
      the child `NavDisplay` acquires and retains models in the outer
      SearchHub composition rather than replacing this owner.

## 2. Member search state and repository

- [x] 2.1 Add an injectable member-search repository and immutable
      `MemberSearchUiState` with explicit query, submit, reset and event-ack
      events.
- [x] 2.2 Move submitted query, result list, loading/searched/error state and
      authentication handling from Compose into `MemberSearchViewModel`.
- [x] 2.3 Cancel or supersede older member requests when the query changes,
      reset runs, the ViewModel clears, or the account entry is removed.
- [x] 2.4 Reduce `MemberSearchScreen` to state collection, rendering and event
      forwarding; retain its existing profile and Search mode callbacks.

## 3. Host map state and repositories

- [x] 3.1 Add injectable map/circle data, place lookup and community-note source
      boundaries plus immutable `HostMapUiState`, safe `PlaceSuggestion` and
      `MapViewport` values, and explicit events.
- [x] 3.2 Move visible-area offer search, filter state, circles, place query /
      suggestions / lookup, visible-note filtering and safe received-note data
      into `HostMapViewModel`. Keep selected-offer detail, profile and
      membership data in the independently decorated `HostDetailVisit` entry.
- [x] 3.3 Move map-search and place-search debounce, cancellation and
      generation checks into the ViewModel; deduplicate identical successful
      viewport/filter fingerprints after recreation; keep `MapView` creation,
      viewport projection, drawing, keyboard/focus and transient menus in
      Compose.
- [x] 3.4 Keep the live Nostroots notes source bounded by the actual Search-root
      entry lifecycle and `includeMeet`; close it on stop, filter disable or
      entry clear; retain note state across temporary mode/child-route hiding,
      but clear it when Meet is disabled. Ignore callbacks from a replaced
      source generation.
- [x] 3.5 Preserve map defaults, existing filter semantics and retryable error
      messages; retain nonblank server text and failure kind for render-time
      XML fallback; deliver and acknowledge authentication invalidation once.
- [x] 3.6 Keep place lookup text-only: use the Android `Geocoder` adapter on
      IO and return primitive place suggestions; request no device-location
      permission and retain no Activity `Context`, `Address` or `Geocoder` in
      ViewModel state.

## 4. Search visit retention and reset

- [x] 4.1 Obtain both ViewModels from the actual decorated Search
      `MemberTabVisit(Destination.Search, visitID)` store through a factory in
      `SearchHubScreen`, above its child `NavDisplay`; pass them
      to active mode content and retain them when a Profile/detail route hides
      Map. Keep credentials out of UI and saved navigation state.
- [x] 4.2 Retain both models' query, filter, result and camera state while
      switching modes, temporarily leaving Search, opening/backing from child
      destinations and recreating the Activity; do not reload a completed
      identical map query solely due to Activity recreation.
- [x] 4.3 Implement explicit same-tab Search reset to map root; cancel old
      requests, reset both ViewModels, restore default map camera/filters and
      clear member query/results without adding a shell visit.
- [x] 4.4 Ensure sign-out/session invalidation clears entry stores, cancels
      requests, closes the notes source and gives a subsequent account fresh
      models.

## 5. Regression coverage

- [x] 5.1 Add fake-repository unit tests for member query editing/submission,
      minimum length, empty results, retryable errors, reset, cancellation,
      stale responses and one-shot auth acknowledgement.
- [x] 5.2 Add fake-repository/unit tests for map defaults, exact filter/bounds
      derivation, debounce and viewport deduplication, place suggestions and
      selection, retry, note visibility/source generations, stale completions,
      cancellation, note-source close and auth acknowledgement. Verify no
      `Context`, `Address`, `MapView` or credential enters state.
- [x] 5.3 Add Android journeys for Activity recreation retaining query,
      results, map filters and camera without duplicate successful requests;
      switching search modes; tab-away/return; actual HostDetail/Profile child
      route Back; note-source stop/reconnect; and same-tab reset of both modes.
- [x] 5.4 Add Android journeys for session invalidation/sign-out during an
      in-flight request, account replacement with fresh state, and absence of
      cookie/session values from saved state and route keys.
- [x] 5.5 Retain existing anonymous member/map journeys for searching,
      geocoding, filters, host selection, profiles, map notes and request
      failures; add no server or web end-to-end tests because this change only
      affects the native Android application.

- [x] 5.6 Verify map-specific session expiry clears the Search entry and a new
      account starts with default camera and filters using its own credentials.

## 6. Validation and completion

- [x] 6.1 Run relevant Android unit and instrumentation tests, lint and debug
      build after the Navigation 3 entry APIs are confirmed.
- [x] 6.2 Update `native-android-member-app`, validate the completed change and
      archive it after implementation and verification.

## Activity-journey evidence

- `Navigation3MemberShellJourneyTest.memberSearchStateSurvivesModeTabAndActivityChangesAndResetsOnReselection`
- `Navigation3MemberShellJourneyTest.mapVisitRetainsCameraAndFiltersAcrossActivityRecreationWithoutRepeatingItsQuery`
- `Navigation3MemberShellJourneyTest.hostDetailDialogRestoresAboveTheSameMapEntryWithoutRepeatingRequests`
- `Navigation3MemberShellJourneyTest.expiredMemberSearchClearsTheSearchEntryForANewAccount`
- `Navigation3MemberShellJourneyTest.expiredHostMapClearsFiltersAndCameraForANewAccount`
- `HostMapMarkerJourneyTest.detailAndProfileRoutesKeepTheMapAndItsNotesConnectionAlive`

Root validation: the final Android device run passed 368/368 tests; repository
checks and the full Android build, unit tests and lint passed. The living
requirement is updated during archive closeout.
