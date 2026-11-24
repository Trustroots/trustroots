## ADDED Requirements

### Requirement: Acquisition-story email and search

The acquisition-stories view SHALL provide a live text filter over the latest 500 stories. It SHALL match case-insensitive substrings of member usernames, display names, origin and living locations, and acquisition-story text. The filter SHALL combine with existing filters and preserve the selected sort order.

The API and table SHALL expose each story member's stored account email only to viewers with the administrator role. Administrators SHALL also be able to filter by account email. The API SHALL omit pending email addresses and tokens.

#### Scenario: Administrator finds a member by email

- **WHEN** an administrator enters part of a member's account email
- **THEN** matching rows display the account email and respect the other active filters
- **AND** clearing the query restores rows that pass the other filters

#### Scenario: Welcome or support team member searches by username

- **WHEN** a viewer with the welcome-team or support-team role and without the administrator role enters part of a member's username
- **THEN** matching rows are shown
- **AND** the response and table omit account emails

## MODIFIED Requirements

### Requirement: Greeter-assisted signup email confirmation

Acquisition stories SHALL show a labelled email confirmation status derived from existing account state. An account with a public profile or no pending email SHALL be shown as confirmed; an account with a non-public profile and a pending email SHALL be shown as unconfirmed. List responses SHALL omit pending email addresses and confirmation tokens.

Welcome-team, support-team and administrators SHALL be able to request a fresh signup confirmation from an unconfirmed row. The server SHALL validate the target and current eligibility, atomically replace the matching pending signup token with a fresh 24-hour token, and send the standard signup confirmation to the pending address. The old link SHALL stop working. Reissuing SHALL not activate the account, alter its pending address or make its profile public. The endpoint SHALL be audited and inaccessible to ordinary or unauthenticated visitors.

The action SHALL only appear for unconfirmed rows, disable repeat clicks while sending, and show success or actionable failure feedback. The server SHALL reject missing, confirmed, non-acquisition and superseded targets without overwriting a newer account state. An established account with a pending email change SHALL remain confirmed and SHALL not receive signup confirmation through this action.

#### Scenario: Greeter replaces an expired signup link

- **WHEN** a greeter resends signup confirmation for an unconfirmed acquisition-story member
- **THEN** the member receives a fresh confirmation link valid for 24 hours
- **AND** the preceding link no longer works while the profile stays unconfirmed

#### Scenario: Confirmed account

- **WHEN** acquisition stories include a confirmed account, including one with a pending email change
- **THEN** its row shows confirmed and no resend action
- **AND** direct requests to resend signup confirmation are rejected

#### Scenario: Unauthorised visitor

- **WHEN** an unauthenticated visitor or ordinary member calls the resend endpoint
- **THEN** access is denied without issuing a token or sending mail

#### Scenario: Account state changes during resend

- **WHEN** confirmation or another pending-email update wins a race with staff reissue
- **THEN** staff reissue fails without reverting the account or overwriting the newer change

#### Scenario: Sending fails

- **WHEN** a resend request fails
- **THEN** the row reports the failure and allows retrying without showing success
