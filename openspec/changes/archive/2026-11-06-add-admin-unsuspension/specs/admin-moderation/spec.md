## ADDED Requirements

### Requirement: Confirmed administrator unsuspension

Administrators SHALL be able to choose Unsuspend for suspended members, confirm the action and provide a non-empty reason of at most 1,000 characters. The administrator-only API SHALL require confirmation and a valid reason, recheck the current state atomically and remove only the `suspended` role. Other roles, visibility, subscriptions and account data SHALL remain unchanged. A successful state change SHALL increment the authentication version once, and a repeated request for an already-unsuspended account SHALL make no further change. A stale snapshot SHALL require refreshing and reviewing the current state.

Audit history SHALL record the acting administrator, member, reason, timestamp and outcome. The audit intent SHALL be durable before the state change. The report SHALL refresh after success and show clear errors for operation or refresh failures.

#### Scenario: Administrator restores access

- **WHEN** an administrator confirms unsuspension with a valid reason
- **THEN** the member’s suspended role is removed and the report refreshes
- **AND** the member can sign in subject to their remaining restrictions
- **AND** audit history records the administrator, member, reason, timestamp and outcome

#### Scenario: Other restrictions remain

- **WHEN** a member has other roles or private profile settings during unsuspension
- **THEN** those roles and settings are retained, including any shadow ban

#### Scenario: Request is unauthorised or incomplete

- **WHEN** a non-administrator requests unsuspension, or confirmation/reason is missing or invalid
- **THEN** the request is rejected without changing the member

#### Scenario: Repeated or stale requests

- **WHEN** unsuspension is repeated after completion
- **THEN** no additional role or authentication-version change occurs
- **WHEN** roles or authentication version change after the administrator’s server snapshot
- **THEN** the update is rejected and the administrator is asked to refresh

#### Scenario: Audit or refresh fails

- **WHEN** initial audit storage fails
- **THEN** the member remains suspended
- **WHEN** outcome storage or report refresh fails after removing suspension
- **THEN** the durable audit intent remains and the UI explains that the administrator must refresh the report
