## Context

`TrustrootsApp` restores the live `MemberSession` before rendering the
authenticated `MemberShell`. The shell currently owns a nested Navigation 3
back stack of distinct `MemberTabVisit` entries. Its tab `NavDisplay` already
uses saveable-state and ViewModel-store entry decorators. A separate
Activity-level `MemberShellViewModelStoreOwner` currently manages child stores
by account, but is not a navigation entry and owns no shell business state.

Within `MemberShell`, `api.profile(session, username)` supplies the avatar id
used by the persistent bottom navigation. A separate effect polls
`api.inbox(session)` immediately and every 60 seconds, restarting when the
active tab visit changes. This badge must continue updating while Circles,
Search or Profile is active, regardless of whether the Messages screen exists.

## Goals and non-goals

**Goals:**

- Give shell business state a genuine root Navigation 3 entry whose key is
  scoped to the signed-in public username.
- Preserve nested tab entry identities and all existing navigation, alert,
  reselection, leave-guard and Back behaviour.
- Keep unread refresh independent from the Messages entry and preserve the
  immediate refresh on active-tab visit changes plus the 60-second cadence.
- Stop polling and cancel in-flight work while the Activity lifecycle is not
  started; resume with an immediate refresh.
- Make response ordering, account replacement, authentication invalidation and
  API-client recreation deterministic and testable.

**Non-goals:**

- Changing endpoint payloads, unread counting rules, badge copy or avatar
  rendering.
- Moving inbox threads or tab-specific state into the shell model, or using an
  Inbox ViewModel as a shell data bridge.
- Persisting credentials, API responses, avatar/profile objects or unread
  message content to saved state or disk.
- Changing server, web, iOS, analytics event names, alert routing or tab
  navigation semantics.

## Decisions

### Use a real authenticated root entry

Wrap the authenticated shell in a root Navigation 3 `MemberShellVisit`
containing only the signed-in username. Apply
`rememberSaveableStateHolderNavEntryDecorator()` and
`rememberViewModelStoreNavEntryDecorator()` to its `NavEntry`, and obtain the
shell model from that entry's `LocalViewModelStoreOwner`. Keep the existing
`MemberTabVisit` stack and its decorators nested under the root entry; do not
replace or flatten tab history. Retain the Activity-owned per-account graph
store solely as the root decorator's parent container. It does not own shell
business state: `MemberShellViewModel` remains in the decorated
`MemberShellVisit` store. On sign-out or session invalidation, explicitly clear
the account graph store before removing authenticated content. On account
replacement, `activateAccount` clears the old graph before creating a new
account store. This handles branch disposal while the root route itself was
not popped, while the Activity-owned container survives configuration
recreation. A different username yields a new root identity and fresh shell
state.

The live `MemberSession` remains sourced from `TrustrootsApp` after the secure
session store loads. It is passed to the repository adapter at runtime and is
never placed in a route key, `SavedStateHandle`, immutable UI state or
persistent storage. Retain the existing `MemberShellViewModelStoreOwner` as
the per-account Navigation 3 graph container. It is not a second owner of shell
business state: all root and tab ViewModels remain in their actual decorated
route stores beneath it.

### Keep the repository narrow and typed

Define a `MemberShellRepository` that can update its current live API/session
references and perform two safe queries: fetch the current member's avatar
identifier, and fetch the unread count. The production adapter calls the
existing profile and inbox endpoints and reduces their results immediately;
it never exposes message threads or a full profile to the ViewModel. Represent
request failures using the existing HTTP status and error-message fields, and
keep translated labels in the UI layer.

Replace adapter references when Compose supplies a recreated API client, but
do not treat a new object with the same `MobileApiClient.backendURL` and same
account as a new data source or repeat completed reads. A changed backend or
session identity invalidates in-flight work and reloads the avatar. Do not put
the cookie in state or compare it by copying it into a route or saved value.

### Own shell state and one-shot invalidation

`MemberShellUiState` contains the nullable avatar id, unread count, refresh
status, a typed retryable failure and an identified pending session-invalidated
event. It contains no session, client, profile, message, or cookie data. A
single idempotent authentication latch covers both avatar and unread requests;
the UI delivers the existing `onSessionInvalidated` callback and acknowledges
the event once. Ordinary request failures preserve the last successful badge
and remain eligible for the next poll.

Track generations for avatar and unread work. Account/backend changes and
clearing the root entry cancel or supersede outstanding requests; late results
must not overwrite newer state. A failed avatar lookup may retry on a later
resume or explicit repository retry, without repeatedly retrying in a tight
composition loop.

### Preserve unread refresh semantics across lifecycle

The shell UI sends the active `MemberTabVisit.visitID` and lifecycle-started
state as explicit model events. A newly active visit causes one immediate
unread refresh, then polling continues every 60 seconds while started. A
duplicate lifecycle or recomposition event for the same active visit does not
start parallel work. Moving to stopped cancels the timer and in-flight unread
request; returning to started refreshes immediately and restarts the cadence.
The poll remains owned by the root shell model and does not depend on Messages
being composed or on any inbox-screen model.

The UI continues to derive the badge and avatar URL for the existing bottom
navigation bar from safe state plus the live API adapter. Existing alert
handling, analytics, leave guards, tab reselection resets, and nested Back
dispatch remain in the shell/navigation layer.

### Verify through model and real Activity tests

Use fake repository tests to verify initial avatar/unread loads, the exact
unread count, immediate refresh on a changed visit, periodic refresh only while
started, cancellation and stale-result rejection, same-backend client
replacement without duplicate successful reads, backend/account replacement,
retryable non-authentication failures and one-shot authentication handling.
Use anonymous fixtures.

Add a real Activity journey that verifies the shell root survives recreation,
the nested tab visit and its owner remain intact, and the recreated API client
does not cause duplicate completed avatar/unread requests. Verify active-tab
change refreshes unread independently of the Messages screen, stopped lifecycle
pauses polling, resume refreshes once, and sign-out/account replacement clears
old shell state. Keep all test values fictional and assert no cookie appears in
serialized route keys or saved shell state.
