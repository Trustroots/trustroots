## 1. Define the authenticated root owner

- [x] 1.1 Add a serialisable `MemberShellVisit` route containing only the
      public username and host the authenticated shell as its decorated
      Navigation 3 entry.
- [x] 1.2 Preserve the nested `MemberTabVisit` stack, its entry decorators,
      identity and all existing navigation / Back semantics under the root.
- [x] 1.3 Retain the Activity-level per-account graph-store container, use it
      as the root decorator's parent owner, and explicitly clear it on sign-out,
      invalidation and account replacement while preserving it through
      configuration changes.

## 2. Extract shell state and repository

- [x] 2.1 Add an injectable repository for avatar-id and unread-count lookups
      using the existing profile and inbox endpoints.
- [x] 2.2 Add immutable shell UI state and explicit events for account/API
      updates, lifecycle, active-tab visit changes, explicit unread refresh,
      retry and event
      acknowledgement.
- [x] 2.3 Move avatar lookup and unread count/poll ownership out of Compose;
      keep unread polling independent of Messages screen composition.
- [x] 2.4 Preserve API-client recreation without duplicate reads for the same
      backend/account; cancel and supersede work when backend, account or root
      entry changes.
- [x] 2.5 Deliver authentication invalidation once, retain typed retryable
      failure state for ordinary errors, and keep credentials out of state and
      saved navigation data.
- [x] 2.6 Pause and cancel unread polling while stopped; resume with one
      immediate refresh and the existing 60-second cadence.

## 3. Regression coverage

- [x] 3.1 Add `MemberShellViewModelTest` coverage for initial loads, unread
      counting, active-tab refresh, lifecycle pause/resume, request
      cancellation, stale completions, API recreation, account/backend
      replacement, ordinary failures, explicit refresh cancellation and
      one-shot authentication delivery.
- [x] 3.2 Add a real Activity journey verifying decorated root ownership,
      nested-tab retention across recreation, no duplicate successful lookups,
      shell-wide badge refresh without Messages, lifecycle polling and account
      cleanup using anonymous fixtures.
- [x] 3.3 Retain existing shell navigation, alert, reselection, Back and badge
      presentation assertions; add no server or web end-to-end test because
      this is native-only state ownership.

## 4. Validation and completion

- [x] 4.1 Run focused Android unit and instrumentation tests, lint, debug build
      and repository checks after implementation.
- [x] 4.2 Strictly validate this focused OpenSpec change.
- [x] 4.3 Update `native-android-member-app` and archive this change during
      integration closeout.

## Validation evidence

- Android unit tests and lint: passed in the full Android build;
  `MemberShellViewModelTest` covers 11 repository, lifecycle, stale-work,
  failure and invalidation cases.
- Android instrumentation: all 368 API 36 journeys passed, including the
  shell-owned unread/lifecycle/recreation journey and root/child store cleanup
  plus sign-out/new-account journeys.
- Debug APK build: passed in the full Android build.
- Repository `pnpm check`: passed. The final validation report also records
  253 client suites / 1,907 client tests and four configuration tests.
- Strict OpenSpec validation: passed; the living requirement is updated during
  archive closeout.
