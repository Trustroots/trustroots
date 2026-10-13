## ADDED Requirements

### Requirement: Vite remains opt-in during build evaluation

The project SHALL provide an opt-in Vite build and development server for the
current React shell while retaining the existing Webpack build as the default
until equivalent application behaviour is demonstrated.

#### Scenario: Developer starts the Vite prototype

- **WHEN** a developer invokes the Vite development command
- **THEN** the typed React entry is served through the configured backend proxy
- **AND** the existing Webpack development command remains available

#### Scenario: Production assets are built with Vite

- **WHEN** the opt-in Vite production build runs
- **THEN** it compiles the typed React entry and emits JavaScript and CSS at the paths expected by
  the backend
- **AND** it does not remove or overwrite unrelated generated assets
