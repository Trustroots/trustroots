## ADDED Requirements

### Requirement: Restricted-account signals in acquisition stories

The system SHALL compare acquisition-story rows with a bounded set of
suspended and shadowbanned accounts and show possible matches to authorised
administrators. Match signals SHALL include similar normalised identifiers,
identical normalised acquisition stories, and conservatively similar
acquisition stories. Matches SHALL NOT automatically change account state.

#### Scenario: Acquisition story resembles a restricted account

- **WHEN** an authorised administrator opens the acquisition-stories view
- **AND** a story row resembles a suspended or shadowbanned account
- **THEN** the row identifies the matching restricted account
- **AND** labels the identifier, exact-story, or similar-story signal
- **AND** links to the restricted account's member report

#### Scenario: Acquisition story has no restricted-account signal

- **WHEN** an authorised administrator opens the acquisition-stories view
- **AND** a story row has no qualifying restricted-account match
- **THEN** the row is shown without a restricted-account lead
