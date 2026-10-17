## ADDED Requirements

### Requirement: Tiered workspace layout

The repository SHALL be organised as a pnpm workspace with the tiers `apps/*`, `layers/*`, `modules/*` and `packages/*`, plus `tooling/*` outside the tiers. Imports SHALL only go down: an app may import layers, modules and packages; a layer may import modules and packages; a module may import packages and declared module dependencies; a package may import only packages.

#### Scenario: Package imports a higher tier

- **WHEN** a change makes a package import a module, layer or app
- **THEN** the tier guard fails in CI

#### Scenario: Module imports another module without declaring it

- **WHEN** a module imports another module that is not listed as a `workspace:*` dependency in its `package.json`
- **THEN** the tier guard fails in CI

### Requirement: Module dependencies are declared and ratcheted

Each module SHALL be a source-only private workspace package whose `package.json` declares its dependencies on other modules. Module links, including model lookups by name, SHALL NOT be added unless the baseline is updated in the same change, and links removed from the code SHALL be removed from the baseline.

#### Scenario: New link between modules

- **WHEN** a change adds an import or model lookup between two modules
- **THEN** CI fails until the dependency is declared and the baseline updated

### Requirement: Affected-only local checks

The repository SHALL provide a command that runs lint, typecheck and tests only for the packages a change touches and the packages that depend on them. CI on the default branch SHALL continue to run the complete suite, and the coverage gate SHALL remain a single repository-wide check.

#### Scenario: Contributor changes a leaf module

- **WHEN** a contributor runs the affected-only command after changing a module nothing else depends on
- **THEN** only that module's checks run

#### Scenario: Per-package tests pass but global coverage drops

- **WHEN** affected-only checks pass and repository-wide coverage falls below the baseline
- **THEN** the CI coverage gate fails
