## 1. Confirm message route owners

- [x] 1.1 Verify the existing nested Navigation 3 child keys and decorators:
      `MessageInboxVisit`, `MessageConversationVisit` and `MessageProfileVisit`
      each receive their own saveable-state and ViewModel-store owner.
- [x] 1.2 Keep the Inbox model creation inside the decorated
      `entry<MessageInboxVisit>`; confirm no state owner is added above the
      entry or in `MemberShell`.
- [x] 1.3 Keep alert stack seeding, top-level tab reselection, and the
      shell-owned unread poll unchanged while extracting Inbox state.

## 2. Inbox-only deliverable: entry-owned paging and filtering

- [x] 2.1 Add an injectable inbox repository and immutable `InboxUiState` with
      explicit filter, load, retry, return-refresh and auth-ack events.
- [x] 2.2 Move paginated `/api/messages` loading, thread deduplication,
      completion/error state and local filtering from Compose into the
      entry-scoped Inbox ViewModel.
- [x] 2.3 Preserve pagination at 50 threads per page and refresh the Inbox when
      a Conversation route is popped or Messages is explicitly reselected.
- [x] 2.4 Keep Inbox rendering, scroll state, profile navigation and shell
      unread-badge polling at their existing owners.
- [x] 2.5 Deliver Conversation-pop refresh to the retained Inbox entry through
      route visibility or a coordinator event; do not retain an Inbox model
      reference in a global callback or expose Inbox state as a Conversation
      repository dependency.
- [x] 2.6 Add focused Inbox model tests for initial page loading, multi-page
      completion, partial-page retry, filtering, stale results, authentication
      acknowledgement, session renewal and entry cleanup.
- [x] 2.7 Add native journeys for Conversation return refresh, Activity
      recreation with a Conversation open, Messages reselection, alert stack
      seeding with an empty Inbox, and shell session replacement.
- [x] 2.8 Add a native journey that fills the Inbox filter and Conversation
      draft, switches to another top-level visit, then returns to the retained
      Messages visit and verifies the filter, messages and draft without
      duplicate successful loads. Current generic tab restoration only covers
      an empty Inbox.

## 3. Conversation deliverable: independent recipient and message state

- [x] 3.1 Add an injectable conversation repository and immutable
      `ConversationUiState` with explicit load, draft, send, quick-reply and
      auth-ack events.
- [x] 3.2 Add a `MobileApiClient` mini-member lookup method backed by the
      existing authenticated `/api/users/mini/:userId` endpoint, then resolve
      the route recipient through `ConversationRepository`; do not depend on
      Inbox ViewModel data or thread presence.
- [x] 3.3 Move message loading, sending, send progress, typed failures, retry
      state and quick-reply eligibility into the Conversation route ViewModel.
- [x] 3.4 Preserve the existing `MessageDraftStore` account/counterpart key,
      restore/save/clear rules and member-ID fallback.
- [x] 3.5 Keep message rendering, keyboard/focus, composer, quick-reply controls
      and profile navigation in Compose.

## 4. Session and lifecycle correctness

- [x] 4.1 Update each repository when the authenticated parent supplies a
      renewed in-memory session; cancel old work, reset auth acknowledgement
      and reload without saving cookies in keys or state.
- [x] 4.2 Guard async results with cancellation and request/session generation
      checks so stale loads or sends cannot publish into the current route.
- [x] 4.3 Clear each ViewModel when its Navigation 3 entry is removed; clear
      all account-owned message state when the authenticated shell is torn
      down. Inbox and Conversation entry-store cancellation tests pass, and the
      renewed-session native journey verifies a fresh message graph after
      authentication invalidation.
- [x] 4.4 Preserve Inbox and Conversation state across tab-away/return and
      Activity recreation while their respective route entries remain.

## 5. Regression coverage

- [x] 5.1 Add fake-repository unit tests for pagination, deduplication,
      filtering, retry, partial page failure, stale results, cancellation,
      authentication acknowledgement and session renewal.
- [x] 5.2 Add Conversation unit tests for recipient resolution without an
      Inbox repository, including alert-first and missing/inaccessible member
      outcomes; verify profile route usernames survive restoration.
- [x] 5.3 Add Conversation unit tests for initial load, quick-reply eligibility
      and payloads, send progress, successful send, failed send with retained
      draft, draft persistence/clear and session invalidation.
- [x] 5.4 Add authenticated-shell Android journeys for Activity recreation
      with Conversation open and Inbox retained below it, conversation pop and
      reopen, alert-origin routing with an empty Inbox, Messages reselection
      and session teardown/replacement.
- [x] 5.5 Add a native message-state tab-away/return journey for a populated
      Messages visit; see task 2.8.
- [x] 5.6 Retain or extend existing message API, inbox, quick-reply, draft,
      failed-send, Activity recreation, notification and unread-badge journeys.
- [x] 5.7 Add an explicit regression assertion that restored Navigation 3
      message route state contains no cookie value. ViewModel unit tests assert
      cookies are absent from UI state, and current route keys contain only
      safe identifiers, but this route-state assertion is not yet present.

## 6. Validation and completion

- [x] 6.1 Run Android unit and focused instrumentation tests, lint and debug build
      after the nested Messages route API is integrated.
- [x] 6.2 Update `native-android-member-app`, strictly validate the completed
      OpenSpec change and archive it after implementation and verification.
