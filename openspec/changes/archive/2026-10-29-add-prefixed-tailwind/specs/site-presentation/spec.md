## ADDED Requirements

### Requirement: Isolated utility styles

The web client SHALL provide prefixed Tailwind utilities alongside existing
Bootstrap styles without applying Tailwind's global Preflight reset. Brand
utilities SHALL use the existing shared web design tokens.

#### Scenario: Existing pages retain their styling

- **WHEN** a page uses existing Bootstrap classes without Tailwind utilities
- **THEN** Tailwind does not reset or replace its existing styles

#### Scenario: Utilities use shared tokens in both directions

- **WHEN** a web component uses a prefixed brand utility in LTR or RTL
- **THEN** the utility resolves to the corresponding shared design token
