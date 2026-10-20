## Why

`TrustrootsApp` currently owns restoration and transitions of the authenticated
`MemberSession`, including persistence and account-scoped cache cleanup. This
work sits at the application boundary rather than in a screen ViewModel, but it
is still business state and orchestration embedded in a composable. An
Activity-scoped session owner will make those existing transitions explicit
and testable while keeping the session cookie out of Navigation 3 and saved
state.

## What Changes

- Add an Activity-scoped `AppSessionViewModel` for restoring and publishing the
  current session, signed-out feedback, member updates, sign-in, sign-out and
  authentication invalidation.
- Keep `TrustrootsApp` as a renderer and navigation boundary. It observes the
  session state and delivers sign-in/member-update/sign-out/invalidation events;
  the model coordinates the existing session store, response cache, sign-in
  destination holder and authenticated shell owner.
- Preserve the current encrypted `SecureMobileSessionStore` representation and
  semantics, including its best-effort `SharedPreferences.apply()` persistence.
  Do not add a stronger durability promise, remote validation, endpoint, or
  session format. A failed/decryption-invalid stored session continues to
  restore as signed out.
- Preserve the current startup presentation: restore once, show Startup for at
  least 700 ms measured from restore start, then show sign-in or the authenticated
  shell. Do not delay longer than the existing minimum when restore itself
  takes longer.
- Preserve sign-in and member-update ordering: invoke the existing store save,
  then publish the in-memory session. Sign-in also clears signed-out feedback
  and the sign-in browser destination. Member update replaces the member while
  retaining the current cookie.
- Preserve sign-out and invalidation cleanup order: clear the current account's
  response cache using the normalised active backend URL and username; clear
  stored session; clear sign-in destination; clear authenticated shell entry
  stores; then publish signed-out state. Invalidation additionally publishes
  the existing session-expired feedback; explicit sign-out does not.
- Keep live cookies only in `MemberSession` memory and the existing encrypted
  store. Never put them in `SavedStateHandle`, Navigation 3 keys, Android saved
  state, logs, or analytics. Do not move route history into this model.
- Bind member-update, sign-out and invalidation callbacks to a transient
  source identity containing account, cookie and normalised backend; ignore a
  late callback once any part no longer matches the active session. Clear the
  model's runtime session and feedback when the Activity owner is finally
  cleared, without clearing the persisted session on Activity destruction.
- Keep backend activation semantics: the sign-in destination holder observes
  the normalised backend and clears its destination on a backend change. A
  backend change alone does not sign out or rewrite the stored session. The
  authenticated shell receives the updated API client and its existing
  ViewModels handle backend changes/cancellation as they do now.
- Deliver this work with the signed-out Navigation 3 changes in one focused
  PR, so navigation callbacks become typed session events without creating a
  separate migration-only PR.

## Capabilities

### Modified Capabilities

- `native-android-member-app`: specify app-scoped session restoration and
  transition ownership, safe credential boundaries, startup timing and cleanup
  behaviour.

## Impact

- Affects `TrustrootsApp`, the sign-in callback boundary, session/authentication
  tests and the existing Android app navigation flow.
- Uses existing `SecureMobileSessionStore`, `SecureResponseCache`,
  `SignInDestinationStoreHolder` and `MemberShellViewModelStoreOwner`; no API,
  server, database, cookie-format, route-key or iOS changes.
