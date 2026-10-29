### Requirement: Layers do not import applications

Production source in `layers/*` SHALL NOT import `apps/*`. The existing source-import guard SHALL recognise the supported literal import forms, workspace names, root aliases, relative paths and file URLs. Layer tests SHALL be excluded. Imports from layers to modules, packages, other layers, root configuration and external dependencies SHALL remain permitted.

#### Scenario: Layer imports application source

- **WHEN** production layer source imports an app through a supported literal import spelling
- **THEN** the boundary guard fails with the source file and offending import

#### Scenario: Layer composes allowed lower tiers

- **WHEN** production layer source imports modules, packages, configuration or external dependencies
- **THEN** the layer-to-app boundary guard passes

#### Scenario: Layer tests exercise application composition

- **WHEN** a layer test imports application composition
- **THEN** that test import is excluded from the production boundary rule
