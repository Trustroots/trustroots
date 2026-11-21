## MODIFIED Requirements

### Requirement: Isolated utility styles

The web client SHALL use prefixed Tailwind utilities and shared design tokens
alongside its own global styles. The production web client SHALL build without
the Bootstrap stylesheet, package or compatibility shim. Utility classes SHALL
take precedence over global element rules for the same property.

#### Scenario: Existing pages retain their styling

- **WHEN** a visitor opens a migrated web page
- **THEN** its form controls and responsive layout retain their presentation and behaviour
- **AND** its direction-sensitive layout follows the selected reading direction

#### Scenario: Utilities use shared tokens in both directions

- **WHEN** a web component uses a prefixed brand utility in LTR or RTL
- **THEN** the utility resolves to the corresponding shared design token

#### Scenario: Utilities override legacy element rules

- **WHEN** a button carries a prefixed border radius or cursor utility
- **THEN** the utility value takes precedence over the global element rule
