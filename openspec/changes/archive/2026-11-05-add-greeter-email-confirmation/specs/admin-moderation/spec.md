## ADDED Requirements

### Requirement: Greeter-assisted signup email confirmation

Acquisition stories SHALL show a labelled email confirmation status derived from existing account state. An account with a public profile or no pending email SHALL be shown as confirmed; an account with a non-public profile and a pending email SHALL be shown as unconfirmed. List responses SHALL expose no email addresses or tokens for this feature.

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
