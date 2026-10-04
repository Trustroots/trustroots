# developer-tooling Specification

## Purpose

Define build and verification requirements for languages used in Trustroots client code so incremental changes remain testable and visible to CI.

## Requirements

### Requirement: Client TypeScript support

The project SHALL compile client `.ts` and `.tsx` modules used by the current application and SHALL type-check those modules in CI without requiring existing JavaScript to pass TypeScript checking.

#### Scenario: JavaScript imports a converted client utility

- **WHEN** a JavaScript client module imports a converted TypeScript utility without a file extension
- **THEN** the development and production bundles resolve and compile the utility
- **AND** client tests can import and exercise it

#### Scenario: A client TypeScript file contains a type error

- **WHEN** the type-check command runs in CI
- **THEN** the command fails on that error

### Requirement: Client tooling retains TypeScript visibility

The project SHALL include client TypeScript and TSX in linting, test discovery, coverage collection and translation extraction where those tools apply.

#### Scenario: A translated client module is converted to TypeScript

- **WHEN** translation extraction runs
- **THEN** its translation keys are still extracted

#### Scenario: A covered client module is converted to TypeScript

- **WHEN** client coverage runs
- **THEN** that module remains in the coverage calculation

### Requirement: Core, messaging and support client modules use strict TypeScript

All production modules under `modules/core/client`, `modules/messages/client` and `modules/support/client` SHALL use `.ts` or `.tsx` with meaningful strict types, while preserving their runtime behaviour, translations, module exports and import compatibility.

#### Scenario: Existing JavaScript callers import migrated platform modules

- **WHEN** a JavaScript caller imports a migrated core, messaging or support module without an extension
- **THEN** the development and production bundles resolve and compile that module
- **AND** client tests can import and exercise it

#### Scenario: Type-checking migrated platform modules

- **WHEN** the client TypeScript check runs
- **THEN** it checks the migrated core, messaging and support modules under strict TypeScript settings
- **AND** the migration does not rely on broad `any` types or TypeScript/lint suppressions

### Requirement: Member-facing client modules use strict TypeScript

The users, contacts, tribes, experiences and references-thread client modules SHALL use `.ts` or `.tsx` for all migrated production modules, with meaningful types that pass the project TypeScript checks without suppressing diagnostics.

#### Scenario: Migrated member modules are type-checked

- **WHEN** the project TypeScript check runs
- **THEN** every migrated production module is included in the check and passes without blanket `any` types or TypeScript suppression comments

#### Scenario: Existing member-facing imports remain compatible

- **WHEN** existing client modules import a migrated module using its prior extensionless or explicit `.js` path
- **THEN** client bundling and tests resolve the converted module with the same runtime behaviour

#### Scenario: Member-facing client coverage stays complete

- **WHEN** client tests and full client coverage run after migration
- **THEN** migrated functionality remains covered and the client coverage requirement stays at 100 percent

### Requirement: Administration, offers and search client code use TypeScript

The project SHALL implement administration, offers and search client modules in strict TypeScript while preserving existing runtime behaviour and client test coverage.

#### Scenario: Administration, offers or search code is type-checked

- **WHEN** the client TypeScript type-check runs
- **THEN** administration, offers and search client modules are included in the strict check
- **AND** those modules contain no unchecked JavaScript implementations

#### Scenario: Administration, offers or search code is covered by client tests

- **WHEN** the client test suite and coverage run
- **THEN** the migrated modules remain exercised by their existing tests
- **AND** the established client coverage thresholds remain satisfied

#### Scenario: JavaScript callers use explicit `.js` imports for migrated modules

- **WHEN** an existing JavaScript client module imports an administration, offer or search module with an explicit `.js` suffix
- **THEN** Jest and Webpack resolve the corresponding TypeScript or TSX source
- **AND** no JavaScript compatibility shim is required

### Requirement: Public pages and statistics client code use TypeScript

The project SHALL implement the public pages and statistics client modules in strict TypeScript while preserving their existing runtime behaviour and client test coverage.

#### Scenario: A public page or statistics module is type-checked

- **WHEN** the client TypeScript type-check runs
- **THEN** public pages and statistics client modules are included in the strict check
- **AND** those modules contain no unchecked JavaScript implementations

#### Scenario: Public pages or statistics code is covered by client tests

- **WHEN** the client test suite and coverage run
- **THEN** the migrated modules remain exercised by their existing tests
- **AND** the established client coverage thresholds remain satisfied

### Requirement: Pull request line-change summary

CI SHALL maintain one updated pull request summary comment showing added,
removed and net lines separately for application code, tests and fixtures,
documentation/configuration/other, and generated files/lockfiles. Counts SHALL
compare the current PR head with its merge base and account for renames using
the destination path. Binary files SHALL be reported outside line totals.

Green SHALL indicate reduced application code or increased tests; yellow SHALL
indicate the opposite direction without failing CI. Unchanged and neutral
groups SHALL use white. Labels and signed counts SHALL explain the result
without relying on colour alone.
Reports for fork and older PRs SHALL execute only trusted main-branch tooling;
fetched PR commits SHALL be used solely as diff data.

#### Scenario: Code and test changes

- **WHEN** a PR removes application code and adds tests
- **THEN** its comment shows separate additions, removals and green net counts
- **AND** existing coverage results remain in the comment

#### Scenario: Neutral and opposite changes

- **WHEN** application code grows, tests shrink, or only neutral files change
- **THEN** the table uses yellow for the first two and white for neutral groups
- **AND** these directions do not determine CI success

#### Scenario: Documentation-only PR

- **WHEN** a PR changes only documentation or configuration
- **THEN** CI still provides its line-change table
- **AND** the comment does not claim that skipped coverage suites passed

#### Scenario: Renames and binaries

- **WHEN** a PR renames a file or changes a binary file
- **THEN** renamed line changes use the destination category
- **AND** binary files are counted separately without invented line counts

#### Scenario: Updated PR head

- **WHEN** a new commit is pushed to a PR
- **THEN** CI refreshes the same summary comment for the current PR head

#### Scenario: Backfill older open PRs

- **WHEN** a maintainer dispatches the report with a PR-number upper bound
- **THEN** all open PRs below that number receive updated line-change tables
- **AND** existing coverage content is retained
- **AND** only trusted main-branch report code executes
