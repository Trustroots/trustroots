## ADDED Requirements

### Requirement: Shared package source boundaries

Production source in `packages/*` SHALL depend only on its own package, declared shared workspace packages and external dependencies. A repository import outside `packages/*`, including application configuration, modules, layers, apps and tooling, SHALL fail the boundary guard. Imports of another shared package SHALL require that package to be declared as a `workspace:*` dependency in the importing package's dependencies, optionalDependencies or peerDependencies. Package tests SHALL be excluded from this production-source rule.

Source-bearing shared package directories SHALL have a valid manifest with a package name. Production source files and directories SHALL NOT be symbolic links; the guard SHALL resolve import paths through real filesystem targets to enforce package ownership. Absolute file imports outside the repository SHALL fail.

The guard SHALL inspect static imports, re-exports, import types, CommonJS imports and literal dynamic imports. It SHALL recognise workspace package names and subpaths, repository-root aliases and relative paths, and report the source file and import that violates a boundary. The repository SHALL run the guard and regression tests in CI and expose commands for local use.

#### Scenario: Shared package imports application code

- **WHEN** shared package production source imports a module, layer, app, root configuration or tooling file through a repository alias, relative path or known workspace name
- **THEN** the guard fails with the source file and offending import

#### Scenario: Shared package imports an undeclared sibling package

- **WHEN** shared package production source imports another shared package without declaring it as a `workspace:*` dependency
- **THEN** the guard fails even if the import uses a relative or repository-root path

#### Scenario: Shared package uses permitted dependencies

- **WHEN** shared package production source imports its own files, an external dependency or a shared package declared as a `workspace:*` dependency
- **THEN** the guard passes

#### Scenario: Package integration tests import application code

- **WHEN** package test files or files within package test directories import application code
- **THEN** those test imports do not count as production package dependencies

#### Scenario: Package source would be skipped or its ownership disguised

- **WHEN** a source-bearing package has a missing or invalid manifest, or production source uses a symbolic link
- **THEN** the guard fails with a diagnostic instead of silently omitting the source
