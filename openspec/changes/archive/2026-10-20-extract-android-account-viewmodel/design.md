## Context and ownership

`MenuNavigationDisplay` creates a `MenuPageVisit(MenuPage.Account, visitID)`
and applies both the saveable-state and ViewModel-store Navigation 3 entry
decorators to its `NavDisplay`. Obtain the Account model from that page's
current `LocalViewModelStoreOwner`, through a factory. Do not use an Activity-,
shell-, or application-wide ViewModel store. Opening Reset Password pushes a
`MenuBrowserVisit` above Account, so the account entry and its model remain
alive until Back or a Menu reset removes them. Reselecting Menu clears the
child stack and therefore the Account entry owner.

Use one Account-scoped model for the whole Account page, including account
fields, password work, message-alert settings, preview-update settings and
sign-out orchestration. These controls share the same route lifetime, dirty
form guard and authenticated session; separate component ViewModels would
split state and side-effect sequencing without an independent navigation
owner. Keep the existing Usage Analytics preference component outside this
model because it is a separate app preference with its own storage semantics.

## State, events and repository boundary

Expose `StateFlow<AccountSettingsUiState>` with immutable, context-free data:
account details and editable email/newsletter values; account-load/save state;
current/new/verification password values and password-change state; typed
status and `UiFailure` values; message-alert enabled/status state; preview
alert enabled/checking/result state; and derived `isDirty` / `isBusy` values.
Represent statuses with sealed or enum values plus safe parameters such as a
release version; Compose selects localized string resources. Never put a
preformatted localized label, `Context`, `Activity`, `Intent`, Compose state,
`MobileApiClient` or cookie in UI state.

Use explicit events for field edits, save, password change, retry, alert
settings, preview check/open, reset-password navigation, guarded Back, sign-out,
and effect delivery/acknowledgement. Inject an `AccountRepository` for
account details, account update and password change, and an
`AccountPlatformSettings` boundary for app-context operations such as reading
and setting persistent alert preferences, disabling message alerts, checking
preview releases and observing platform status. The repository adapter may
hold the live `MemberSession` privately in memory for requests. Never serialize
it or the `MobileApiClient`.

Load account details once when the new Account entry model starts. Activity
recreation retains the model and does not issue a second successful load.
Explicit retry can start another load after failure. A separate Account visit
gets a fresh model. A restored process with a newly created model performs a
fresh account read; it does not restore account responses or credentials from
saved state.

Account/email and password requests run in `viewModelScope`, preserve
cancellation, and use request generations or identity checks before applying
results. Ignore obsolete completions after a newer save, retry, sign-out or
entry removal. Gate duplicate submissions while the matching operation is
active. Authentication failure creates one identified session-invalidated
event; the UI delivers the existing shell callback and acknowledges that ID
once. Other failures remain typed `UiFailure` values resolved by the current
resource fallbacks.

Compute dirty state from the loaded account baseline and editable email and
newsletter fields, plus any non-empty password draft. Compute busy state from
account save/password change. Keep `rememberFormLeave` and its discard dialog
in Compose so toolbar Back, system Back, predictive Back dispatch and the
Reset Password child route use the existing interaction. The guard consumes
only the model's `isDirty` and `isBusy`; it does not own request state.

Password inputs may live in the in-memory Account ViewModel only while the
Account entry is retained. Never put them into `SavedStateHandle`, navigation
keys, logs or persistent preferences. Clear all three fields after successful
change and when the ViewModel is cleared. Keep current validation (non-empty
current/new values and matching new/verification values) and current
server-driven failure behavior. Do not add client-side password policy.

## Android platform effects

The model owns message-alert and preview-update business state and decides
when an operation is valid. Android components remain adapters at the UI
boundary:

- Compose owns `ActivityResultLauncher` instances for notification permission.
  The model emits a typed, identified `RequestNotificationPermission` effect;
  the UI acknowledges dispatch before launching and sends the permission
  outcome as a new event. A recreated Activity re-registers the launcher and
  receives the system result without re-launching an already acknowledged
  request.
- Enabling UnifiedPush requires an `Activity` for distributor selection.
  After permission is granted, Compose invokes a narrow Activity-bound
  adapter, then reports a typed semantic result to the model. The adapter
  must not retain the Activity beyond that operation. Translate outcomes at
  the UI boundary into resource-backed status kinds; do not store localized
  strings in the model. Disabling alerts and reading the enabled preference
  use an application-context port.
- Preview release checking uses an application-context/settings port and
  cancellation/generation checks. Store only typed outcomes and safe release
  metadata. Opening the release URL is a one-shot typed UI effect; Compose
  starts the external activity and acknowledges the effect so Activity
  recreation does not reopen it.
- Sign-out is an Account event gated against duplicates. The model runs the
  existing disable-message-alerts then API sign-out sequence through injected
  ports and emits one identified completion effect for the shell callback.
  Preserve the current best-effort ordering and do not expose the cookie or
  Activity to the composable. Authentication invalidation and sign-out both
  remove the authenticated shell and clear the Account entry store.

All one-shot effects carry IDs and are acknowledged by the owning Account
model. User-initiated work is not automatically repeated after recreation.
The UI only handles platform-bound operations and navigation delivery; request
sequencing, duplicate suppression, state transitions and failure categories
remain in the Account model or injected use cases.

## Behaviour and regression coverage

Use anonymous fixtures and fake account/platform repositories. Unit tests
cover one-time load, retry, dirty baseline updates, duplicate save gating,
success and typed failure, password validation and secret clearing, late and
cancelled requests, auth acknowledgement, notification enable/disable,
permission result handling, update-check cancellation/status, sign-out ordering
and duplicate-effect suppression. Assert that no UI state or saved navigation
state contains a cookie or password after the relevant cleanup path.

Add native journeys through a real Menu Account entry for editing/saving email
and newsletter, password success/failure, discard guard for toolbar/system
Back and Reset Password, message-alert permission and UnifiedPush result,
preview-alert permission/check/release launch, sign-out, and Activity
recreation. Verify that recreation retains unsaved safe drafts without
reloading account details or repeating a completed side effect; an explicitly
new Account visit performs a new read; a removed Menu entry cancels work and
clears password state. Keep the existing API and Account journey tests intact.
