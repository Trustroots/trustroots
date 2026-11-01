## MODIFIED Requirements

### Requirement: Owned UI primitives

The web client SHALL provide reusable Button, Alert, Badge and Spinner
primitives independent of application configuration and translations. Their
styles SHALL be prefixed Tailwind utilities using theme tokens declared by the
UI package, SHALL use shared design values and SHALL preserve existing
presentation. Every button-styled element in the app SHALL render through the
owned Button, which consumers configure by variant, colour and size rather than
by class names.

#### Scenario: Language loading fails

- **WHEN** the language selector cannot load its options
- **THEN** it displays the existing warning using the owned Alert primitive
- **AND** the warning retains its alert semantics

#### Scenario: Accessible controls and status

- **WHEN** a consumer renders a button, alert or loading indicator
- **THEN** the primitive exposes appropriate native or ARIA semantics
- **AND** its text is supplied by the consumer

#### Scenario: Link styled as a button

- **WHEN** a consumer gives the Button a link to render
- **THEN** the link shows the button look
- **AND** it remains a link with its own destination

#### Scenario: Button without a type

- **WHEN** a consumer renders a Button without a type inside a form
- **THEN** activating it does not submit the form
