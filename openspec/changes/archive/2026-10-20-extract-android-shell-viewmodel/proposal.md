## Why

The authenticated Android shell currently keeps the member's avatar identifier
and unread-message count in `MemberShell` composition state. Its avatar lookup
and shell-wide inbox polling are consequently tied to a composable effect rather
than a durable authenticated navigation owner. This makes lifecycle behaviour,
account replacement, request cancellation and one-shot authentication handling
hard to verify, while the shell must keep unread badges current even when the
Messages tab is not visible.

## What Changes

- Add a serialisable, account-scoped `MemberShellVisit` as the actual root
  Navigation 3 entry for the authenticated shell, with saveable-state and
  ViewModel-store decorators.
- Retain an Activity-owned per-account Navigation 3 graph store solely as the
  root decorator's container, so sign-out and account replacement explicitly
  clear every root and nested entry store while configuration changes retain
  them.
- Move the own-avatar identifier and shell-wide unread count, refresh status,
  typed failures and one-shot session-invalidation event into an entry-owned
  `MemberShellViewModel` backed by an injectable repository.
- Keep shell polling independent of the Messages inbox screen. Refresh unread
  count immediately when the active top-level visit changes, then at the
  existing 60-second interval while the app is started; cancel work while
  stopped and resume with an immediate refresh.
- Keep `MemberTabVisit` as the owner of each tab's child state and preserve its
  navigation, reset, alert-origin and Back behaviour.
- Keep live sessions, cookies and API clients as runtime dependencies only;
  the root route stores only the public account username.

## Capabilities

### Modified Capabilities

- `native-android-member-app`: define the authenticated shell root entry,
  account-scoped shell state, unread refresh lifecycle and credential-safe
  ownership.

## Impact

- Android shell navigation and state under
  `apps/android/app/src/main/java/org/trustroots/android/ui`.
- New shell repository/ViewModel and focused unit and native journey tests.
- No API, server, persistent-data or web/iOS changes. Existing endpoints are
  sufficient; the shell will continue using the current profile and inbox
  requests.
