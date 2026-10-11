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

### Requirement: Shared API contracts check payload construction

The project SHALL strictly check the server payload construction and client
consumption of the staff-blocker and experience APIs against shared contracts.
The experience contracts SHALL represent private payloads and reciprocal
responses without claiming that hidden fields are present.

#### Scenario: A server payload drifts from its shared contract

- **WHEN** a checked payload builder returns an incompatible field or omits a required field
- **THEN** the blocking typecheck command fails

#### Scenario: A client misuses an API response

- **WHEN** a client treats a reciprocal experience response as a complete experience or assumes private feedback is present
- **THEN** the blocking typecheck command fails

#### Scenario: Contract checking preserves runtime behaviour

- **WHEN** the server constructs a staff-blocker or experience response
- **THEN** existing HTTP shapes and privacy filtering remain unchanged
- **AND** existing client/server coverage requirements and end-to-end scenarios are retained

### Requirement: Pull request dependency summary

The automated pull request overview SHALL show added, removed, changed and net counts for direct runtime dependencies, direct development dependencies and resolved lockfile entries alongside line changes. It SHALL compare the PR merge base with its head, retain coverage content when refreshed, and list changed dependency declarations and resolved versions. Trusted reporting code SHALL parse manifests and lockfiles as data without executing PR code. Reports SHALL explain that lockfile entries count installed paths, including duplicates, and do not measure production-image pruning.

#### Scenario: Dependency removal and version update

- **WHEN** a PR removes a direct dependency and updates a resolved version
- **THEN** the overview reports the removal and update separately
- **AND** it lists the affected dependency names and before/after values

#### Scenario: Manifest or lockfile is absent

- **WHEN** a compared commit lacks a manifest or lockfile
- **THEN** its dependency inventory is empty for that file
- **AND** added or removed entries remain visible

#### Scenario: Refresh and merge-base comparison

- **WHEN** the overview is refreshed after the base branch advances
- **THEN** it compares against the merge base without counting unrelated base work
- **AND** the same comment contains one dependency summary and retains coverage content

### Requirement: Production image dependency inventory

The production image job SHALL inventory application npm packages from the built image after pruning. The overview SHALL show installed-path and unique name/version counts and provide a complete inventory artifact. It SHALL explicitly report an unavailable inventory when the image job is skipped or fails, and SHALL NOT infer installed packages from the source lockfile or claim an image-to-image delta without a baseline image inventory.

#### Scenario: Image built successfully

- **WHEN** the production image is built
- **THEN** CI collects package metadata from its actual application node_modules directory
- **AND** the overview shows installed and unique package counts with a downloadable inventory

#### Scenario: Image inventory unavailable

- **WHEN** the image is not built or its inventory cannot be collected
- **THEN** the overview states that its installed inventory is unavailable
- **AND** lockfile counts remain labelled separately
