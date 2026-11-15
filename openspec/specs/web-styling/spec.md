# web-styling Specification

## Purpose

Define the web client styling conventions and preserve presentation and directionality as legacy runtime styling is removed.

## Requirements

### Requirement: Style web components without runtime-injected styled-components

Web client components SHALL use shared UI components where appropriate, static utility classes, or local stylesheets. Data-dependent values such as an avatar's size or colour MAY be applied through React style props. Migrations SHALL preserve existing semantic HTML, class behaviour, responsive layouts, interaction states, and direction-sensitive presentation.

#### Scenario: Existing component styling is migrated

- **WHEN** a web component is migrated from styled-components
- **THEN** it retains its existing HTML semantics and visual behaviour
- **AND** its styling uses shared UI, static utility classes, local stylesheets, or React style props for data-dependent values

#### Scenario: Production dependency is removed

- **WHEN** the web styling migration is complete
- **THEN** application production source contains no styled-components imports
- **AND** styled-components is absent from the application manifest and lockfile
