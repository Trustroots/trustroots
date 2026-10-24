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

Each module SHALL be a source-only private workspace package whose `package.json` declares its dependencies on other modules. Module links, including model lookups by name, SHALL NOT be added unless the baseline is updated in the same change, and links removed from the code SHALL be removed from the baseline. The module graph guard SHALL recognise `@trustroots/<module>` imports and subpaths as well as existing root aliases and relative paths.

#### Scenario: New link between modules

- **WHEN** a change adds an import or model lookup between two modules
- **THEN** CI fails until the dependency is declared and the baseline updated

### Requirement: Affected-only local checks

The repository SHALL provide a command that runs lint and client tests for changed module workspace packages and their dependents, followed by repository-wide typechecking. Selection SHALL account for committed, staged, unstaged and non-ignored untracked changes against the merge base with `origin/main`, overridable through `TURBO_SCM_BASE`. If a change falls outside recognised module workspace packages or comparison cannot be established, the command SHALL run full `pnpm check`. CI on the default branch SHALL continue to run the complete suite, and the coverage gate SHALL remain a single repository-wide check.

#### Scenario: Contributor changes a leaf module

- **WHEN** a contributor runs the affected-only command after changing a module nothing else depends on
- **THEN** only that module's lint and client tests run, followed by repository-wide typechecking

#### Scenario: Contributor changes shell composition or root files

- **WHEN** a contributor changes a file outside recognised module workspace packages, including `layers/shell`
- **THEN** the affected-only command runs full `pnpm check` and explains the fallback

#### Scenario: Comparison history is unavailable

- **WHEN** the comparison reference or merge base cannot be established
- **THEN** the affected-only command runs full `pnpm check` and explains the fallback

#### Scenario: Per-package tests pass but global coverage drops

- **WHEN** affected-only checks pass and repository-wide coverage falls below the baseline
- **THEN** the CI coverage gate fails
