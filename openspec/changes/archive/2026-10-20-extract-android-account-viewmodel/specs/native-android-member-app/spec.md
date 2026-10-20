## ADDED Requirements

### Requirement: Account settings state is owned by its Menu visit

The Android Account page SHALL expose account, password, message-alert and
preview-update state from one ViewModel owned by its decorated
`MenuPageVisit(MenuPage.Account, visitID)` entry. The ViewModel SHALL use
immutable context-free state, explicit events and injectable account/platform
settings boundaries. It SHALL preserve the existing account APIs, dirty-form
guard, notification permission flow, preview-update behaviour, reset-password
navigation and sign-out ordering. Android permission launchers, Activity-bound
UnifiedPush selection and external URL launching SHALL remain in the UI
adapter and SHALL communicate through identified, acknowledged effects.

The Account entry MAY retain safe drafts while it remains on the Menu back
stack and across Activity recreation. A recreated Activity SHALL NOT by itself
repeat an account read or a completed platform side effect. A new Account visit
SHALL create fresh state and load the account once. The ViewModel SHALL cancel
its work and clear account-owned in-memory state when its entry is removed. It
SHALL NOT persist a member session, cookie, `MobileApiClient`, password, email
draft, account response, `Context`, `Activity` or platform object in route
keys, saved state or persistent storage. Password inputs SHALL be cleared on
successful password change and when the ViewModel is cleared. User-facing
status labels SHALL be resolved from Android resources at the UI boundary.

#### Scenario: Account visit loads once and survives Activity recreation

- **WHEN** a member opens Account and Android recreates the Activity while the
  Account visit remains on the Menu back stack
- **THEN** the Account entry retains its safe form and status state
- **AND** account details are not fetched a second time solely because the
  Activity was recreated
- **AND** no completed permission, external-link or sign-out effect is
  dispatched again

#### Scenario: Member saves account settings or changes password

- **WHEN** a member submits changed email/newsletter settings or a valid
  current/new/verification password form
- **THEN** the Account ViewModel runs the existing API operation once and
  publishes success or a context-free typed failure
- **AND** obsolete or cancelled responses do not overwrite newer state
- **AND** a successful password change clears all password inputs

#### Scenario: Member leaves Account with a dirty form

- **WHEN** the member uses toolbar Back, system Back or opens Reset Password
  while account or password fields are dirty
- **THEN** the existing discard guard is shown
- **AND** confirming performs the selected navigation action while cancelling
  keeps the Account visit and its current drafts
- **AND** the guard prevents leaving while an account or password save is active

#### Scenario: Member changes notification settings

- **WHEN** the member enables message or preview-update notifications on a
  device that requires runtime permission
- **THEN** the ViewModel emits one identified permission effect and the Compose
  Activity Result launcher requests permission
- **AND** the permission outcome is delivered as an explicit event without the
  ViewModel retaining an Activity
- **AND** denial, retry, UnifiedPush selection and setting status retain their
  existing user-visible semantics without replay after Activity recreation

#### Scenario: Preview update is checked and opened

- **WHEN** the member requests an update check or chooses an available release
- **THEN** the Account ViewModel owns the check generation, cancellation and
  typed result state
- **AND** the UI opens the release URL at most once for the acknowledged effect
- **AND** translated status labels are resolved from Android resources

#### Scenario: Account request invalidates the session or member signs out

- **WHEN** an account request reports authentication failure or the member
  signs out
- **THEN** the Account owner delivers one identified session-invalidated or
  signed-out effect to the existing shell
- **AND** sign-out preserves the existing message-alert disable then API
  sign-out ordering
- **AND** removing the authenticated shell clears the Account entry and
  cancels its work

#### Scenario: Account entry is removed or process state is restored

- **WHEN** the Account visit is removed by Back, Menu reselection or shell
  removal, or a process is restored without its in-memory ViewModel
- **THEN** removed-entry work is cancelled and its password values are cleared
- **AND** a new Account model fetches current server details instead of
  restoring account responses, cookies or password drafts from saved state
