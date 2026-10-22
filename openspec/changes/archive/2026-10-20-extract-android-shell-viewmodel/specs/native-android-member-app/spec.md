## ADDED Requirements

### Requirement: Authenticated shell state belongs to a root Navigation 3 visit

The authenticated Android shell SHALL be rendered by a decorated root
Navigation 3 entry scoped to the signed-in public username. The root entry
SHALL own the shell's avatar identifier and unread-message badge state, while
each top-level tab visit SHALL retain its existing distinct Navigation 3
entry and child-state lifetime. The root route and saved shell state SHALL NOT
contain session credentials, cookies, API clients, message content or profile
payloads.

#### Scenario: Member shell restores after Activity recreation

- **WHEN** Android recreates the Activity while an authenticated member is in
  a top-level tab visit
- **THEN** the root shell and nested tab visit restore under the live session
- **AND** completed avatar and unread lookups are not repeated solely because
  the API client object was recreated for the same backend and account
- **AND** no cookie or session credential is present in route keys or saved
  shell state

#### Scenario: Shell unread badge refreshes independently of Messages

- **WHEN** a member changes the active top-level tab or the shell's 60-second
  unread interval elapses while the Activity is started
- **THEN** the root shell refreshes the unread count using the existing inbox
  endpoint even if Messages is not composed
- **AND** the unread badge continues to show the count of unread threads

#### Scenario: Shell polling follows Activity lifecycle

- **WHEN** the Activity stops while the authenticated shell is active
- **THEN** the root shell cancels its unread timer and in-flight unread request
- **WHEN** the Activity starts again
- **THEN** the shell performs one immediate unread refresh and resumes the
  existing 60-second cadence

#### Scenario: Authentication expires during a shell lookup

- **WHEN** the avatar or unread request reports an expired session
- **THEN** the shell delivers the existing session-invalidation callback once
- **AND** removing the authenticated root clears its shell state and nested
  visit stores

#### Scenario: Account changes while shell requests are outstanding

- **WHEN** the current authenticated account is replaced or its API backend
  changes before a shell request completes
- **THEN** the old request is cancelled or ignored
- **AND** the new root visit displays no result from the former account
