## 1. Resolve Navigation 3 ownership

- [x] 1.1 Confirm the current Search `MemberTabVisit` owner through
      `LocalViewModelStoreOwner` and the existing ViewModel-store entry
      decorator.
- [x] 1.2 Add an identified reset generation scoped to the active Search visit
      so same-tab reset clears member-search state without adding a history
      visit or resetting a different retained Search visit.
- [ ] 1.3 Confirm the host-detail route/resource owner and the map note-source
      reconnect lifecycle against the integrated navigation and client APIs.

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

- [ ] 3.1 Add injectable map data and place lookup boundaries plus immutable
      `HostMapUiState`, viewport value and explicit events.
- [ ] 3.2 Move visible-area offer search, filter state, circles, place query /
      suggestions / lookup, host context, circle memberships and note filtering
      from Compose into `HostMapViewModel`.
- [ ] 3.3 Move map-search and place-search debounce, cancellation and
      generation checks into the ViewModel; keep `MapView` creation, drawing,
      keyboard/focus and transient menus in Compose.
- [ ] 3.4 Keep the live Nostroots notes source bounded by the Search entry
      lifecycle; close it on entry clear and preserve received safe note state
      while the entry remains retained.
- [ ] 3.5 Preserve map defaults, existing filter semantics and retryable error
      messages; deliver and acknowledge authentication invalidation once.

## 4. Search visit retention and reset

- [ ] 4.1 Obtain each ViewModel from the confirmed Search root Navigation 3
      entry store through a factory; keep credentials out of UI and saved
      navigation state.
- [ ] 4.2 Retain both models' query, filter, result and camera state while
      switching modes, temporarily leaving Search, opening/backing from child
      destinations and recreating the Activity.
- [ ] 4.3 Implement explicit same-tab Search reset to map root; cancel old
      requests, reset both ViewModels, restore default map camera/filters and
      clear member query/results without adding a shell visit.
- [ ] 4.4 Ensure sign-out/session invalidation clears entry stores, cancels
      requests, closes the notes source and gives a subsequent account fresh
      models.

## 5. Regression coverage

- [ ] 5.1 Add fake-repository unit tests for member query editing/submission,
      minimum length, empty results, retryable errors, reset, cancellation,
      stale responses and one-shot auth acknowledgement.
- [ ] 5.2 Add fake-repository/unit tests for map defaults, filter derivation,
      viewport searches, place suggestions and selection, retries, host context,
      note visibility, stale requests, cancellation and auth acknowledgement.
- [ ] 5.3 Add Android journeys for Activity recreation retaining query,
      results, map filters and camera without duplicate successful requests;
      switching search modes; tab-away/return; nested destination Back; and
      same-tab reset of both modes.
- [ ] 5.4 Add Android journeys for session invalidation/sign-out during an
      in-flight request, account replacement with fresh state, and absence of
      cookie/session values from saved state and route keys.
- [ ] 5.5 Retain existing anonymous member/map journeys for searching,
      geocoding, filters, host selection, profiles, map notes and request
      failures; add no server or web end-to-end tests because this change only
      affects the native Android application.

## 6. Validation and completion

- [ ] 6.1 Run relevant Android unit and instrumentation tests, lint and debug
      build after the Navigation 3 entry APIs are confirmed.
- [ ] 6.2 Update `native-android-member-app`, validate the completed change and
      archive it after implementation and verification.
