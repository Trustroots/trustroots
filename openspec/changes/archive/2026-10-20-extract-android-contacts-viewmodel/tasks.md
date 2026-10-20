## 1. Contacts ViewModel

- [x] 1.1 Add the injectable profile-and-contacts repository and typed failure
      identity with optional server-provided message metadata.
- [x] 1.2 Add immutable Contacts state/events, entry-scoped factory, request
      cancellation and stale-generation protection.
- [x] 1.3 Deliver session invalidation once and clear ViewModel state when its
      Navigation 3 entry is removed.
- [x] 1.4 Refactor `ContactsScreen` to collect state and forward retry events;
      keep selected-profile presentation in Compose and resolve fallback copy
      from Android resources.

## 2. Regression coverage

- [x] 2.1 Add anonymous unit coverage for successful and missing-ID loads,
      retry after failure, stale requests, one-shot auth acknowledgement and
      entry teardown.
- [x] 2.2 Add Android journeys for Activity recreation and Back from a selected
      profile without duplicate successful Contacts requests.
- [x] 2.3 Add Android journeys for failed-load retry, session expiry and fresh
      Contacts state after entry teardown.

## 3. Validation and integration

- [x] 3.1 Validate this proposal before implementation and preserve the current
      Contacts screen copy and API behaviour.
- [x] 3.2 Run the relevant Android unit and instrumentation coverage after
      implementation; update `native-android-member-app` and archive this
      focused change when integrated and verified.
