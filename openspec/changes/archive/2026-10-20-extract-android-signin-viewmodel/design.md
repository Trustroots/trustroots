## Context

`SignInScreen` is currently a private composable in
`apps/android/app/src/main/java/org/trustroots/android/ui/TrustrootsApp.kt`.
It owns username, password, error, loading and browser route state, creates a
`MobileApiClient`, and calls an app-level `onSignedIn` callback after a
successful request. `TrustrootsApp` owns `SecureMobileSessionStore`; that
callback saves the encrypted session and switches to the signed-in shell.
Recent sign-in keyboard and footer work also lives in the current screen and
must remain intact.

## Goals

- Give sign-in a named `ui/signin` package and an immutable, screen-scoped
  state model.
- Route field edits, submission, and any error dismissal or clearing behaviour
  through explicit ViewModel events.
- Keep API and asynchronous request handling in the ViewModel, exposing state
  as an immutable `StateFlow` collected by Compose.
- Preserve the existing Compose layout, keyboard actions, keyboard-aware
  scrolling and footer visibility/placement from the keyboard fix.
- Preserve the callback contract: a successful `MemberSession` goes to the
  parent, which persists it with `SecureMobileSessionStore` and navigates to
  the signed-in shell.
- Keep username and password in memory for the sign-in destination lifetime
  so Activity recreation retains them; do not persist them to saved state,
  preferences or disk.

## Non-Goals

- No Navigation3 adoption or changes to other Android screens.
- No changes to API authentication, cookie handling, encryption or session
  persistence.
- No process-death restoration of credentials.
- No redesign of sign-in text, analytics consent controls, or Join / password
  recovery destinations.

## Decisions

### ViewModel boundary

Add a `ui/signin` package containing the sign-in screen and ViewModel. Define a
read-only state value for the credentials, submitting flag, visible error and
pending successful session; expose it as `StateFlow` and collect it in the
composable. Provide explicit events for editing the username and password,
submitting credentials, and acknowledging successful delivery. Submission
trims the username, keeps the password unchanged, disables repeated submission
while in flight, and reports API errors with the existing fallback message. A
failed attempt leaves both fields editable for correction and resubmission.

Keep a small Activity-retained holder ViewModel, acquired from the current
Activity `ViewModelStoreOwner`, which owns a child `ViewModelStore` for the
sign-in destination. Create the `SignInViewModel` through a `ViewModelProvider`
for that child store, passing the API base URL and the current initial
signed-out message through its factory. Do not use
`rememberViewModelStoreOwner`; that API is not part of Lifecycle 2.10.0. The
holder survives Activity recreation, while `TrustrootsApp` explicitly clears
its child store when successful sign-in leaves the destination. This avoids
keeping credentials or an old successful result after logout/session expiry.
Use Lifecycle 2.10.0 APIs and declare `lifecycle-viewmodel:2.10.0` directly;
the implementation obtains the Activity owner and uses `ViewModelProvider`
without a Compose ViewModel helper artifact. Do not bump Lifecycle.

On API success, store the `MemberSession` as a pending result in ViewModel
state. A Compose effect keyed to that result invokes the existing app callback
and then acknowledges delivery. Keep the success in `StateFlow` until delivery
so disposing and recreating the composition during an in-flight request does
not lose it. The parent callback persists the encrypted session synchronously
before changing the signed-in state; clear the child destination store as the
sign-in destination exits, preventing later replay.

### Session and navigation ownership

Keep encrypted persistence in `TrustrootsApp`: on success, the screen invokes
the existing callback with the returned `MemberSession`; the parent saves it,
updates the session state and clears the signed-out message. Join and Forgot
password remain browser routes owned by the screen presentation and continue
to use `browserContent`. Usage analytics continues to track Sign In only while
no browser route is open.

### Rotation and credentials

The Activity-retained holder preserves the child sign-in ViewModelStore across
configuration changes. Clear that child store on successful sign-in before
another sign-in destination is created, including after sign-out or session
expiry. Every new destination gets a new ViewModel initialised with that
entry's message, so fields, error and pending result from a previous account
cannot leak into a later attempt. State remains in memory only; neither
credentials nor success results go into `SavedStateHandle`, preferences or the
encrypted session store. This proposal does not claim to change whether the
app-level startup screen appears on Activity recreation.

## Risks / Trade-offs

- A custom child `ViewModelStore` owner adds lifecycle plumbing; keep it small,
  clear it at the app's sign-in exit transitions, and cover those transitions.
- Moving the screen can regress recent keyboard/footer layout fixes if the
  composable is rebuilt from memory; preserve its modifiers and validate the
  keyboard and footer behaviour in the existing journeys.
- Loading state must reset after both success and failure, including an
  unexpected exception, so the form cannot remain disabled indefinitely.
- The screen receives the signed-out message each time a fresh destination
  store is created; keep the parent as the source of truth for session expiry.
- A pending success must be delivered after a composition is recreated during
  a request, while clearing the child store on exit prevents duplicate delivery
  on a later sign-in.

## Verification

- Add ViewModel unit coverage for initial state, field events, trimmed
  username submission, progress, failure feedback, credential correction and
  successful-result acknowledgement.
- Preserve and run `SignInSessionJourneyTest`,
  `TrustrootsOfflineAndSignInLoadingJourneyTest`, and
  `MainActivityRotationJourneyTest`; add journeys for sign-in → sign-out →
  sign-in and an in-flight sign-in request across Activity recreation. Add a
  focused Compose regression only if the existing journeys do not exercise a
  required keyboard/footer behaviour.
- Run Android unit tests, Android lint and the relevant instrumentation
  journeys after implementation; OpenSpec validates the delta before coding.
