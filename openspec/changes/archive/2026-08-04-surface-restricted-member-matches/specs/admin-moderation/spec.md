## ADDED Requirements

### Requirement: Potential accounts related to restricted members

The system SHALL help authorised administrators investigate a suspended or
shadowbanned member by showing a bounded set of other accounts with a similar
username or email local-part, or an identical normalised acquisition story.
The system SHALL identify the signal that caused each possible match and SHALL
NOT automatically change an account because of a match.

#### Scenario: Administrator opens a restricted member report

- **WHEN** an authorised administrator opens a suspended or shadowbanned
  member report
- **THEN** the report shows the member's acquisition story when available
- **AND** shows a bounded set of possible related accounts
- **AND** identifies whether each account matched the username, email
  local-part, or acquisition story

#### Scenario: Administrator opens an unrestricted member report

- **WHEN** an authorised administrator opens a member report for an account
  without the suspended or shadowban role
- **THEN** the report does not perform or display restricted-member matching

#### Scenario: Possible account match is found

- **WHEN** another account matches one or more restricted-member signals
- **THEN** the administrator can open that account's member report
- **AND** neither account's roles or other state are changed automatically
