## MODIFIED Requirements

### Requirement: Module runtime source boundaries

Production module source SHALL NOT import server code from client source, client
code from server source, or client/server code from shared source. The same
rules SHALL apply to the `client`, `server` and `shared` folders of shared
packages under `packages/*`, including imports of their entry points through a
workspace package subpath such as `@trustroots/analytics/server`. Imports of
shared source from any tier SHALL remain permitted. The guard SHALL use the
same source scanning and path resolution as the module composition boundary
guard, including workspace package subpaths, repository aliases, relative
imports and symlink targets. Tests SHALL be excluded. The guard and regression
tests SHALL run through local lint, affected checks and CI.

#### Scenario: Runtime tier imports cross forbidden directions

- **WHEN** production module source imports a forbidden client/server/shared
  tier through a supported literal import spelling
- **THEN** the runtime boundary guard fails with the source file and import

#### Scenario: Module client source imports a package server entry point

- **WHEN** production module client source imports `@trustroots/analytics/server`,
  or shared package client source imports its own server folder
- **THEN** the runtime boundary guard fails with the source file and import

#### Scenario: Runtime tiers use shared source

- **WHEN** client or server source imports shared source, or shared source uses
  shared source
- **THEN** the runtime boundary guard passes

#### Scenario: Tests import across runtime tiers

- **WHEN** a module test imports client, server or shared code
- **THEN** the runtime boundary guard ignores that test
