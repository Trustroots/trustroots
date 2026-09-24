## MODIFIED Requirements

### Requirement: Public information and circles

The system SHALL make its public information pages, including practical safety
guidance for hosts and travellers, and circle catalogue available without
authentication.

#### Scenario: Visitor browses circles

- **WHEN** a visitor opens the circles page
- **THEN** a list of available circles is displayed

#### Scenario: Visitor opens a public information page

- **WHEN** a visitor opens a supported public information page
- **THEN** the requested page is displayed without requiring authentication

#### Scenario: Visitor opens the safety guidance

- **WHEN** a visitor opens `/safety`
- **THEN** the page presents precautions for arranging and completing stays
- **AND** explains how to report concerning behaviour and respond to an
  immediate emergency
- **AND** provides in-page navigation to its main sections

#### Scenario: Visitor discovers safety guidance from the homepage

- **WHEN** a visitor views the Trustroots homepage
- **THEN** the homepage provides a link to the public safety guidance
