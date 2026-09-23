## ADDED Requirements

### Requirement: Acquisition-story table context

The acquisition-stories view SHALL show each member's profile visibility,
explain its compact column headings, and allow profile visibility to be sorted.

#### Scenario: Administrator opens acquisition stories

- **WHEN** an authorised administrator opens the acquisition-stories view
- **THEN** each story shows whether the member's profile is visible
- **AND** compact column headings provide accessible explanations
- **AND** the administrator can sort the rows by profile visibility

## MODIFIED Requirements

### Requirement: Restricted-account signals in acquisition stories

The system SHALL compare acquisition-story rows with a bounded set of
suspended and shadowbanned accounts and show possible matches to authorised
administrators. Match signals SHALL include similar normalised username and
email local-part identifiers and SHALL NOT include acquisition-story text.
Matches SHALL NOT automatically change account state.

#### Scenario: Acquisition story resembles a restricted account

- **WHEN** an authorised administrator opens the acquisition-stories view
- **AND** a story row has an identifier resembling one from a suspended or shadowbanned account
- **THEN** the row identifies the matching restricted account
- **AND** labels the username, email, or temporary-email identifier signal
- **AND** links to the restricted account's member report

#### Scenario: Acquisition story has no restricted-account signal

- **WHEN** an authorised administrator opens the acquisition-stories view
- **AND** a row shares exact or similar acquisition-story text with a restricted account
- **AND** the accounts have no qualifying identifier match
- **THEN** the row is shown without a restricted-account lead
