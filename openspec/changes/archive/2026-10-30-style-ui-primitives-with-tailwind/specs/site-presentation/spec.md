## MODIFIED Requirements

### Requirement: Isolated utility styles

The web client SHALL provide prefixed Tailwind utilities alongside existing
Bootstrap styles without applying Tailwind's global Preflight reset. Brand
utilities SHALL use the existing shared web design tokens. A utility applied to
an element SHALL take precedence over global Bootstrap and Less element rules
for the same property, without `!important`.

#### Scenario: Existing pages retain their styling

- **WHEN** a page uses existing Bootstrap classes without Tailwind utilities
- **THEN** Tailwind does not reset or replace its existing styles

#### Scenario: Utilities use shared tokens in both directions

- **WHEN** a web component uses a prefixed brand utility in LTR or RTL
- **THEN** the utility resolves to the corresponding shared design token

#### Scenario: Utilities override legacy element rules

- **WHEN** a button carries a prefixed border radius or cursor utility
- **THEN** the utility value applies instead of Bootstrap's or the global Less
  `button` rule

### Requirement: Owned UI primitives

The web client SHALL provide reusable Button, Alert, Badge and Spinner
primitives independent of application configuration and translations. Their
styles SHALL be prefixed Tailwind utilities using theme tokens declared by the
UI package, SHALL use shared design values and SHALL preserve existing
presentation.

#### Scenario: Language loading fails

- **WHEN** the language selector cannot load its options
- **THEN** it displays the existing warning using the owned Alert primitive
- **AND** the warning retains its alert semantics

#### Scenario: Accessible controls and status

- **WHEN** a consumer renders a button, alert or loading indicator
- **THEN** the primitive exposes appropriate native or ARIA semantics
- **AND** its text is supplied by the consumer
