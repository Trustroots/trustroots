## ADDED Requirements

### Requirement: Administrators delete suspended members

Administrators SHALL be able to permanently delete a suspended member from the admin member report after entering the exact current username and a non-empty reason of at most 1,000 characters. They MAY attach up to 20 keyword labels of at most 80 characters each to the audit reason. These labels SHALL NOT automatically change signup rules. The API SHALL enforce administrator access, prior suspension, username confirmation, and protection of the acting administrator and all administrator accounts. Suspension and administrator protection SHALL be checked atomically when removing the account. The UI SHALL explain that suspension is required before deletion.

#### Scenario: Confirmed deletion of a suspended member

- **WHEN** an administrator confirms a suspended member's current username and supplies a reason
- **THEN** the system saves an audit record containing the actor, member ID, username and reason before removing the account
- **AND** it uses existing profile deletion cleanup for offers, contacts, push registrations, messages awaiting notification, circle counts and uploaded files without sending a confirmation email for administrator-initiated deletion
- **AND** the member report is replaced with a success message

#### Scenario: Cleanup fails after the account has been deleted

- **WHEN** an administrator deletes an account and a later cleanup step fails
- **THEN** the remaining cleanup steps are still attempted and failures are logged
- **AND** the API reports that the account was deleted with incomplete cleanup
- **AND** the client clears the member report and displays a warning requiring staff follow-up instead of offering to retry account deletion

#### Scenario: A protected or unsuspended account is selected

- **WHEN** an administrator requests deletion of an unsuspended member, their own account or any administrator account
- **THEN** deletion is refused and the account remains

#### Scenario: Invalid confirmation or unauthorised access

- **WHEN** the username does not match, the reason is missing or too long, or the caller lacks administrator access
- **THEN** no account is deleted

#### Scenario: Audit storage fails

- **WHEN** the audit record cannot be stored
- **THEN** no account is deleted and an error is returned

#### Scenario: Suspension changes before deletion

- **WHEN** suspension is removed or the member becomes an administrator before the atomic account removal
- **THEN** the account is retained and the administrator receives an error

### Requirement: Administrators manage signup review rules

Administrators SHALL be able to list, add, edit and remove signup review rules for keywords, exact email addresses and exact email domains. Rules SHALL use case-insensitive literal matching, with keywords matching identifying profile text, email addresses matching the complete address and domains matching only the complete email domain. Rules SHALL NOT accept regular expressions or match message content. Matching signups SHALL remain allowed and SHALL use the existing flagged-signup staff alert. The existing `support`, `system` and `trustroots` keyword defaults SHALL apply until a list is first saved. The list SHALL permit at most 500 rules with values of at most 254 characters and SHALL reject duplicates and invalid email or domain rules. Saving an empty list SHALL require an explicit acknowledgement that all signup review rules will be disabled, enforced by both the UI and API and recorded in the audit. Rule changes SHALL be audited and concurrent edits SHALL be detected through a revision number.

#### Scenario: Administrator clears the watchlist

- **WHEN** an administrator removes all rules
- **THEN** the UI requires a separate acknowledgement before enabling Save
- **AND** an API save without explicit empty-list confirmation is rejected without changing the rules

#### Scenario: Administrator saves review rules

- **WHEN** an administrator saves a valid rule list with the current revision
- **THEN** an audit record is saved before the new list is stored and its revision is incremented
- **AND** subsequent signups are evaluated against the saved list

#### Scenario: Signup matches an email or keyword rule

- **WHEN** a signup matches a configured rule
- **THEN** the account is created normally and staff receive the existing signup review alert identifying the matching rules

#### Scenario: Concurrent update or unauthorised edit

- **WHEN** a save uses an outdated revision or the caller is not an administrator
- **THEN** the saved rules remain unchanged and the request fails

#### Scenario: Review rule lookup is unavailable

- **WHEN** the configured list cannot be loaded during signup
- **THEN** signup remains available, the failure is logged and the original keyword defaults are used for that request
