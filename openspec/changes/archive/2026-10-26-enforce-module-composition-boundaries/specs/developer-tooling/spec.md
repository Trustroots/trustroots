## ADDED Requirements

### Requirement: Modules do not import composition layers or apps

Production source in `modules/*/{client,server,shared}` SHALL NOT import `layers/*` or `apps/*`. The guard SHALL recognise the same supported literal import forms, workspace names, root aliases, relative paths, file URLs and source ownership rules as the shared-package guard. Tests and generated source SHALL be excluded from this production rule. No existing module-to-layer or module-to-app exception list SHALL be required.

Production module source symlinks, unrecognised imports in the repository-owned `@trustroots/*` namespace and file imports outside the repository SHALL fail rather than silently escaping boundary classification. The guard SHALL classify both the lexical import path and its canonical filesystem target so a symlinked app/layer directory cannot hide an upward import.

The repository SHALL run both package and module boundary checks through local lint, affected checks and CI. Existing module-to-module dependency checks SHALL remain authoritative for declared dependencies and the frozen module graph; legacy root configuration imports SHALL remain outside this bounded rule.

#### Scenario: Module imports client shell or application source

- **WHEN** production module source imports a layer or app through a supported literal import spelling
- **THEN** the module boundary guard fails with the source file and offending import

#### Scenario: Composition and feature dependencies retain their direction

- **WHEN** a layer imports a feature module or feature source imports core interfaces, another module, a shared package, an external dependency or legacy root configuration
- **THEN** this upward-import guard passes
- **AND** existing module graph and manifest guards continue checking module dependencies separately

#### Scenario: Tests exercise composed application behaviour

- **WHEN** a module integration test imports shell composition to exercise feature behaviour
- **THEN** the test is excluded from the production upward-import rule
