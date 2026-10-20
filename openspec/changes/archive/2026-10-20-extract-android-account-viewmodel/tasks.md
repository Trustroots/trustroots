## 1. Confirm the Account route owner and current behaviour

- [x] 1.1 Obtain the Account model from the decorated
      `MenuPageVisit(MenuPage.Account, visitID)` entry owner and factory.
- [x] 1.2 Record current account API, dirty guard, notification, preview
      update, Reset Password and sign-out behaviour in anonymous tests.
- [x] 1.3 Keep Usage Analytics under its existing preference owner and retain
      `MemberLargeTopAppBar`, shell-provided insets and `rememberFormLeave`.

## 2. Account data and password state

- [x] 2.1 Add injectable account repository methods for details, email/newsletter
      update and password change, plus immutable `AccountSettingsUiState` and
      explicit events.
- [x] 2.2 Move account loading, email/newsletter drafts/save and typed API
      failures out of Compose; derive dirty and busy state from the model.
- [x] 2.3 Move password fields, validation and change operation into the model;
      clear password fields after success and ViewModel clear, never persist
      password values in saved state or route keys.
- [x] 2.4 Add cancellation, stale-result checks, duplicate-operation gating,
      explicit retry and identified one-shot session-invalidation delivery.

## 3. Platform settings and navigation effects

- [x] 3.1 Define an application-context platform settings port for message-alert
      preferences, alert disable, preview alert preferences, update checks and
      typed platform statuses.
- [x] 3.2 Move message-alert/update setting state and operation sequencing into
      the Account model; keep permission launchers in Compose and bridge them
      with identified, acknowledged effects and typed result events.
- [x] 3.3 Keep UnifiedPush distributor choice behind a one-operation
      Activity-bound adapter; do not store Activity or Context in the model.
- [x] 3.4 Move sign-out sequencing and duplicate suppression to the model/use
      case, retaining disable-alerts then sign-out ordering and delivering one
      shell completion effect.
- [x] 3.5 Keep external release launch and Reset Password navigation as
      acknowledged UI effects; ensure recreation does not repeat completed
      launches or navigation pushes.

## 4. Lifecycle and regression coverage

- [x] 4.1 Add anonymous fake-repository unit tests for load, retry, edits, save,
      password validation/change, stale/cancelled work, authentication and
      secret clearing.
- [x] 4.2 Add unit tests for message and update alert state, permission results,
      typed statuses, update check generations, sign-out ordering and
      one-shot-effect acknowledgements.
- [x] 4.3 Add native Account-entry journeys covering edit/save, password
      success/failure, dirty leave guard, Reset Password Back, notifications,
      preview updates, sign-out and session invalidation.
- [x] 4.4 Verify Activity recreation retains safe drafts without duplicate
      account loads or external side effects; verify a new Account visit loads
      once and a removed entry clears its work.
- [x] 4.5 Preserve existing account/API journeys and assert no cookie or
      password value enters saved state, route keys or logs.

## 5. Validation and completion

- [x] 5.1 Run relevant Android unit/native tests, lint and debug builds after
      implementation.
- [x] 5.2 Update `native-android-member-app`, validate the completed change and
      archive the proposal after implementation and verification.
