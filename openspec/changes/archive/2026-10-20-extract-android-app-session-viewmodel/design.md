## Current behaviour to retain

`TrustrootsApp` creates `SecureMobileSessionStore` and `SecureResponseCache`
from the application context. It loads the encrypted session on `Dispatchers.IO`
in a `LaunchedEffect`, measures a 700 ms minimum Startup display, and treats a
missing or unreadable/decryption-failed store value as signed out. It does not
validate the restored session remotely before showing the authenticated shell;
normal screen requests may later invalidate it.

On sign-in, `sessionStore.save(session)` is called, then the session is published,
signed-out feedback is cleared, and the sign-in destination is cleared. On a
member update, the current session is copied with the new member and saved
before it is published, retaining its cookie. `SecureMobileSessionStore.save`
uses encrypted SharedPreferences and `apply()`: returning from `save` is not a
promise that disk has synchronously flushed, and this change must not claim one.

On explicit sign-out, the current backend/account response cache is cleared,
the persisted session is cleared, the sign-in destination and shell entry stores
are cleared, and only then is the in-memory session set to null. Authentication
invalidation performs the same cleanup and sets the existing
`SESSION_EXPIRED` feedback. A later successful sign-in clears that feedback.

`SignInDestinationStoreHolder.activateBackend` normalizes the backend URL and
clears sign-in destination history when the backend changes. This does not clear
the persisted/current session. The authenticated shell receives a newly
remembered API client; entry ViewModels already detect backend/session changes,
cancel old requests and reload using their current repositories. Preserve this
behaviour, including existing cache key normalisation.

## Ownership and state

Create an Activity-scoped `AppSessionViewModel`, obtained from the same
`ComponentActivity` owner already used for sign-in and shell store holders. It
owns immutable `StateFlow<AppSessionUiState>` with a small set of renderable
states: restoring (including the optional restored first name needed by
Startup), signed out (optional existing `UiFailure`), and signed in with the
current in-memory `MemberSession`. The `MemberSession` stays a runtime model;
never mirror it into `SavedStateHandle` or a serializable navigation route.

Use explicit events/callback methods for restore, sign-in, member update,
explicit sign-out and authentication invalidation. The model sequences the
existing collaborators and exposes state only after calling the existing
synchronous store API (whose SharedPreferences implementation still uses
`apply()`). The Activity-scoped VM naturally survives configuration changes;
a new process creates a new VM and performs the existing secure-store restore.
Do not add a second restore after configuration recreation.

`TrustrootsApp` remains responsible for composable rendering, `key(...)` scopes,
Navigation 3 stacks, Activity/context discovery and backend activation. It
observes session state, renders Startup/SignIn/MemberShell, passes the live
session into route owners, and forwards events. Keep shell and sign-in owner
cleanup through their existing APIs so their per-entry stores clear at the same
transitions as today. Keep `MessageAlerts` reconciliation and route destination
handling in the authenticated shell; those are not session persistence.

Capture a transient `AppSessionSource` in each authenticated-shell callback.
It identifies the originating account username, cookie and normalised backend;
the cookie field is runtime-only and its diagnostic string representation is
redacted. Member update, sign-out and invalidation are accepted only if all
three still match the active session/environment. This prevents an old request
or duplicate logout callback from updating or clearing a newly signed-in
account, changing its cookie, or a newly selected backend. Invalidation is a
no-op while signed out, so it cannot add an expiry message after explicit
sign-out. Sign-in completion is likewise accepted only for the backend which
started that signed-out flow.

When the Activity-retained ViewModel is finally cleared, cancel the pending
restore and reset its in-memory session and feedback state. Do not clear the
encrypted session store or account cache on `onCleared`: configuration changes
retain this ViewModel, while Activity destruction/process recreation must allow
the next owner to restore the still-persisted session.

Do not turn this into a generic account repository or add remote session
validation. Keep `SecureMobileSessionStore`'s encrypted payload unchanged. The
store has no backend field, and backend changes must not be retrofitted into
its payload. Do not persist the `UiFailure` feedback or session state outside
the existing encrypted session store.

## Concurrency and lifecycle

The model should allow at most one restoration for its lifetime. Run secure
session restoration on `Dispatchers.IO`, as today. Keep sign-in, member-update,
sign-out and invalidation persistence/cache/owner operations synchronous on
the main-thread event callback, preserving the existing save-before-publish
and cache/store/owner-clear-before-signed-out order. This means a successful
sign-in callback cannot return to the form before the root has synchronously
switched its state. `SecureMobileSessionStore` uses asynchronous
`SharedPreferences.apply()`; do not claim disk flush/fsync or add an
asynchronous save gap. Restoration carries a generation and is cancelled when
an explicit transition supersedes it, so a late IO result cannot replace a
newer session. Account cleanup uses the session captured at the time of
sign-out/invalidation, not a later account value.

Preserve the 700 ms minimum Startup delay as one cancellable ViewModel restore
operation. Compute remaining time from the same monotonic elapsed-realtime
clock and restore-start timestamp. If the Activity is recreated during restore,
the retained model continues its single operation and state; a recreated
composable does not restart the timer or store read.

Backend updates remain owned by the existing `DisposableEffect`/sign-in holder
and `MobileApiClient` construction. The session model may receive an explicit
`BackendChanged` event only if needed to order cache cleanup, but it must not
clear or rewrite the session merely because the backend changed. Keep each
existing shell ViewModel's `updateEnvironment` cancellation/reload semantics.

## Verification

Add focused unit tests with injectable store/cache/owner ports and a test
coroutine dispatcher. Cover one restore, empty/corrupt store behavior as
reported by the existing store, the minimum Startup deadline with fast restore,
slow restore exceeding the deadline, sign-in ordering and cleared feedback,
member update retaining the cookie, explicit sign-out cleanup order, invalidation
feedback, duplicate transition suppression, and a save followed by sign-out
never publishing/reinstating the older session. Assert state serialisation and
navigation keys contain no cookie. Also cover stale invalidation, logout and
member-update callbacks after a different session signs in, stale callbacks
after backend replacement, late restoration after `onCleared`, and that
`onCleared` removes runtime state without clearing persisted session data.

Add or extend a real-Activity journey through signed-out Navigation 3 to
sign-in, successful sign-in and sign-out; cover invalidation feedback and the
existing reset-password/sign-up child routes. Recreate the Activity while
restoring and after sign-in to show the same operation/session owner is retained,
then use a fresh process/model fixture to show the secure store is read again.
Cover backend replacement while signed out (destination clears) and signed in
(session remains while current shell owners update/cancel requests), and ensure
cache cleanup uses the current normalised backend and account. Keep anonymous
fixtures. Run the focused Android unit/instrumented suites, Android lint/debug
build, and repository `pnpm check`.
