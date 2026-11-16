## MODIFIED Requirements

### Requirement: Style web components without runtime-injected styled-components

New and migrated web components SHALL use shared UI components where appropriate and Tailwind utilities for static component styles. They SHALL NOT introduce component-scoped stylesheets or CSS Modules. Data-dependent values such as an avatar's size or colour MAY be applied through React style props. Migrations SHALL preserve existing semantic HTML, class behaviour, responsive layouts, interaction states, and direction-sensitive presentation.

#### Scenario: Existing component styling is migrated

- **WHEN** a web component is migrated from styled-components
- **THEN** it retains its existing HTML semantics and visual behaviour
- **AND** its styling uses shared UI, Tailwind utilities, or React style props for data-dependent values

#### Scenario: New static component styling is added

- **WHEN** a contributor adds static styling to a new or migrated component
- **THEN** they use Tailwind utilities or existing shared UI component props
- **AND** they do not add a component-scoped stylesheet

#### Scenario: Production dependency is removed

- **WHEN** the web styling migration is complete
- **THEN** application production source contains no styled-components imports
- **AND** styled-components is absent from the application manifest and lockfile
