## ADDED Requirements

### Requirement: Shared iOS Account overview presentation

The regular iOS member Account screen SHALL render its heading, Nostranslation signing entry point and sign-out action with shared Compose. The iOS host SHALL own account loading, signing navigation and session sign-out.

#### Scenario: Viewing Account while the profile loads

- **WHEN** an authenticated member opens Account while their profile is loading
- **THEN** the shared Account heading remains visible while iOS presents the loading indicator
- **AND** the actions appear when the initial loading stage completes

#### Scenario: Opening signing from Account

- **WHEN** a member selects Nostranslation signing
- **THEN** iOS presents the existing Nostranslation signing sheet

#### Scenario: Signing out from Account

- **WHEN** a member selects Sign out
- **THEN** iOS runs the existing session sign-out flow
