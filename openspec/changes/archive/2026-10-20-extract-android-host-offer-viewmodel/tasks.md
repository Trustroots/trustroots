## 1. Entry-owned model and data boundary

- [x] 1.1 Define immutable Host Offer UI state, explicit events, form defaults,
      validation and current-versus-original dirty comparison.
- [x] 1.2 Add injectable repository and description-normalisation boundary;
      implement profile-then-offer loading and offer save in the production
      adapter without moving session credentials into ViewModel state.
- [x] 1.3 Add an entry-owner ViewModel factory/lookup for the Host menu
      Navigation 3 entry and cancel owned work when that entry is cleared.

## 2. Screen integration

- [x] 2.1 Replace composable-owned Host Offer requests and business state with
      collected ViewModel state and explicit field/action events.
- [x] 2.2 Preserve the existing defaults, decoded editable text, validation,
      maximum-guests normalisation, full save payload and server-assigned ID.
- [x] 2.3 Render `UiFailure` from existing XML fallbacks and render save success
      from its status identity; retain nonblank server messages and API failure
      kinds without storing translated strings.
- [x] 2.4 Keep the existing form leave guard for Cancel, system/predictive Back,
      top-level navigation and in-flight saves.
- [x] 2.5 Add a Retry action for failed initial profile/offer reads without
      presenting a failed read as a new empty offer.

## 3. Regression coverage

- [x] 3.1 Add anonymous ViewModel tests for loading/defaults/HTML normalisation,
      form validation and dirty transitions, retry, authentication-once,
      cancellation and stale completions.
- [x] 3.2 Test stable save snapshots, duplicate-save suppression, successful
      returned ID/baseline updates, and retryable save failures.
- [x] 3.3 Add native form journeys for resource fallback versus dynamic server
      text, keep-editing/discard decisions through Back, and blocked navigation
      during save.
- [x] 3.4 Add a real Activity recreation journey during load and during save;
      assert state survives and no duplicate repository operation is issued.
- [x] 3.5 Run targeted unit and native journey tests, the Android lint/compile
      tasks, and the repository's required `pnpm check`; retain existing
      journey coverage.

## 4. Specification upkeep

- [x] 4.1 Validate this proposal with strict OpenSpec validation before source
      implementation.
- [x] 4.2 After implementation, update the `native-android-member-app` living
      specification and archive this change.
