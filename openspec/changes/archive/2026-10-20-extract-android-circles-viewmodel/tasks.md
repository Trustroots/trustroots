## 1. OpenSpec and Navigation 3 foundation

- [x] 1.1 Validate this proposal before production implementation.
- [x] 1.2 Integrate the verified Navigation 3 entry-store foundation and
      confirm the current-entry ViewModel owner API before coding.

## 2. Circles state and operations

- [x] 2.1 Define immutable `CirclesUiState`, explicit events and an injectable
      circle repository for catalogue, membership reads and membership writes.
- [x] 2.2 Implement an entry-scoped Circles ViewModel with cancellation and
      stale-result guards, retry, filter/sort derivation and acknowledged
      session-invalidation events.
- [x] 2.3 Clear account-owned state on sign-out/account replacement and replace
      the active `MemberTabVisit` on explicit Circles reselection, while
      retaining state on ordinary tab departure and Back.
- [x] 2.4 Reduce `CirclesScreen` and its leaf composables to state rendering,
      event forwarding, Back handling and existing parent callbacks.

## 3. Regression coverage

- [x] 3.1 Add repository-backed unit tests for load, filter/sort, join/leave,
      failures, retries, cancellation/stale results, event acknowledgement and
      account isolation.
- [x] 3.2 Add native journeys for configuration recreation, tab-away/tab-return
      retention, entry removal, explicit reselection reset/reload, membership,
      filter and detail Back behaviour.
- [x] 3.3 Retain existing anonymous circle journeys for loading failures,
      membership authentication failures, descriptions and headers.

## 4. Validation and completion

- [x] 4.1 Run relevant Android unit and instrumentation tests, lint and debug
      build after the Navigation 3 foundation is integrated.
- [x] 4.2 Update the living `native-android-member-app` specification, validate
      the completed OpenSpec change and archive it after implementation.
