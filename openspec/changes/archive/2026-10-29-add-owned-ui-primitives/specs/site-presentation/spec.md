## ADDED Requirements

### Requirement: Owned UI primitives

The web client SHALL provide reusable Button, Alert, Badge and Spinner
primitives independent of application configuration and translations. Their
styles SHALL use shared design values and preserve existing presentation.

#### Scenario: Language loading fails

- **WHEN** the language selector cannot load its options
- **THEN** it displays the existing warning using the owned Alert primitive
- **AND** the warning retains its alert semantics

#### Scenario: Accessible controls and status

- **WHEN** a consumer renders a button, alert or loading indicator
- **THEN** the primitive exposes appropriate native or ARIA semantics
- **AND** its text is supplied by the consumer
