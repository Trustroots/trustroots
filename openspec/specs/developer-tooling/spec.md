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
- **THEN** Jest and Vite resolve the corresponding TypeScript or TSX source
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

### Requirement: Browser-facing message offer and profile contracts

The project SHALL share strict request and response contracts between browser-facing messages, offers and profile client APIs and checked JavaScript server payload builders, preserving existing HTTP shapes, validation and privacy rules.

#### Scenario: An implementation drifts from its contract

- **WHEN** a checked request or response builder constructs an incompatible field
- **THEN** the blocking type-check command fails

#### Scenario: Responses vary by visibility or endpoint

- **WHEN** clients consume deleted message participants, offer GeoJSON or public and own profiles
- **THEN** their types represent the actual response variants and omitted private fields
- **AND** runtime sanitisation and location privacy remain unchanged

#### Scenario: Message pagination uses native URL parsing

- **WHEN** a message response supplies a Link header
- **THEN** the client extracts the next relation's query parameters without a third-party Link-header parser
- **AND** relative and absolute links, repeated query values, absent next links and the existing 2,000-character limit retain their behaviour

### Requirement: All client tests use strict TypeScript

All module client tests and client-specific test utilities SHALL use TypeScript and be included in strict checking, linting and existing test discovery, without reducing assertions or coverage.

#### Scenario: A test fixture or mock violates a contract

- **WHEN** strict test type-checking runs
- **THEN** incompatible typed fixtures and mocks fail checking without blanket diagnostic suppressions

#### Scenario: The migrated suite runs

- **WHEN** the client tests and coverage run
- **THEN** all previous scenarios remain discoverable and covered
- **AND** established client and server coverage requirements remain satisfied

### Requirement: Shared runtime modules and data fixtures use strict TypeScript

The project SHALL check shared support constants, route policies and common/server data fixture implementations with strict TypeScript. Native server loading SHALL use Node 24 built-in type stripping without an additional compiler dependency, while legacy CommonJS fixture entry points remain compatible.

#### Scenario: A route policy or fixture violates its declared shape

- **WHEN** type checking runs against the shared modules and fixture helpers
- **THEN** incompatible policy values, fixture overrides and helper results fail checking without blanket diagnostic suppressions

#### Scenario: Native and browser consumers load the migrated modules

- **WHEN** Jest, the production bundle or the native server runner loads a migrated module
- **THEN** the existing exported values and functions remain available
- **AND** route access rules, support text and fixture defaults retain their behaviour
- **AND** existing coverage thresholds and end-to-end scenarios remain satisfied

### Requirement: Package manager changes are evidence-led

The project SHALL compare clean and repeat dependency installation time and
validate development and production container installation before changing
the supported package manager.

#### Scenario: Maintainer compares package managers

- **WHEN** the package-manager benchmark runs against the same lockfile inputs
  and runtime
- **THEN** it records cold and warm install duration for each available manager
- **AND** it does not modify the repository's supported package manager

#### Scenario: Container compatibility is evaluated

- **WHEN** a candidate package manager is trialled in development and
  production containers
- **THEN** the report records install completion and required native build
  scripts
- **AND** npm remains supported until the evaluation explicitly recommends a
  separate migration

### Requirement: Production client build uses Vite

The production build command SHALL emit `react-main.js`, `react-main.css`, and
`react-main.rtl.css` with Vite at the paths Express serves. Vite SHALL be the
only supported client build tool in development, production, and end-to-end
CI; Webpack fallback commands SHALL NOT be provided.

#### Scenario: Production build

- **WHEN** the production build command runs
- **THEN** Vite emits the client JavaScript and both stylesheets under `public/assets`
- **AND** unrelated generated files outside that asset build are left in place

#### Scenario: Development and browser tests

- **WHEN** a developer starts the application or CI builds browser test assets
- **THEN** development uses the Vite server and browser tests use the Vite production assets
- **AND** Windows browser tests use the same client build as other end-to-end jobs

### Requirement: CI timing overview

The PR and HTML coverage overviews SHALL show a snapshot of CI job and step
durations with log links, distinguish elapsed workflow time from accumulated
job time, and label incomplete or unavailable timing data without claiming
the reporting job has finished. Reporting SHALL use the current run attempt
and the matching PR head for a companion lint workflow.

#### Scenario: Parallel test jobs finish

- **WHEN** CI generates the overview
- **THEN** completed jobs and their steps show their durations and log links
- **AND** elapsed time is shown separately from accumulated completed job time
- **AND** the slowest completed step is highlighted

#### Scenario: Timing data is incomplete

- **WHEN** a workflow is still running or the API cannot supply timings
- **THEN** the overview identifies the snapshot or unavailable data
- **AND** timing collection does not bypass test or coverage enforcement

### Requirement: CI avoids repeated tooling work

CI SHALL run ESLint once and reuse its output for annotations and enforcement.
Client checks SHALL run on Node 24 with the pinned pnpm version independently
of the development Docker image. End-to-end groups SHALL reuse one asset build
from the same checkout and retain all existing tests and coverage requirements.

#### Scenario: Application PR runs CI

- **WHEN** application CI runs
- **THEN** all existing client checks run directly on Node 24
- **AND** one shared end-to-end asset build supplies all three test groups
- **AND** lint failures still fail CI even if annotation reporting fails

#### Scenario: End-to-end asset build fails

- **WHEN** the shared asset build fails
- **THEN** dependent end-to-end groups cannot report a successful test run

### Requirement: Feature modules have validated workspace manifests

Feature modules SHALL be private source-only pnpm workspace packages. Their workspace dependencies SHALL match the recorded module graph, and CI SHALL reject stale manifests. A developer command SHALL select affected module lint and client test tasks while full CI checks and coverage requirements remain enforced.

#### Scenario: Module dependencies change

- **WHEN** the recorded module graph changes without regenerating manifests
- **THEN** manifest validation fails and identifies the stale manifests

#### Scenario: Developer runs affected checks

- **WHEN** affected checks run against a base revision
- **THEN** workspace tooling selects affected module lint and client test tasks
- **AND** project type checks still run

#### Scenario: Production image installs workspace dependencies

- **WHEN** the production image installs and prunes dependencies
- **THEN** module manifests are available and pruning runs without an interactive prompt

### Requirement: Client route table sits outside feature modules

The client route table SHALL live outside `modules/*`. Composing a feature page into that table SHALL NOT add a module-graph link from `core` to that feature. Repository callers SHALL import route helpers directly from the shell owner; the obsolete core route-table re-export SHALL be removed once its callers have been migrated.

#### Scenario: Feature page is added to the route table

- **WHEN** the shell route table imports a page from a feature module
- **THEN** the module-graph baseline does not gain a link from `core` to that feature

#### Scenario: Existing caller imports the previous path

- **WHEN** an existing repository caller of the previous core route-helper path is migrated
- **THEN** they reference `layers/shell/client/routes` directly
- **AND** no production module needs to import that composition layer

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

### Requirement: Feature runtime interfaces are independent of shell composition

Feature production modules SHALL obtain bootstrap settings/context hooks and the browser navigation primitive from core-owned implementations without importing `layers/shell`. The shell SHALL compose those interfaces with authentication and query providers while owning window bootstrap reading, routing and layout.

Current repository consumers and tooling references SHALL import implementation owners directly. Obsolete core-to-shell re-export files SHALL be removed after their consumers are migrated. State identity, navigation behaviour, client coverage and existing browser journeys SHALL be preserved.

#### Scenario: Feature consumes application settings

- **WHEN** a feature reads settings or application configuration through a core hook inside the shell provider tree
- **THEN** it observes the same bootstrap context and authentication/query state across rerenders
- **AND** its production imports do not reach the shell

#### Scenario: Feature navigates through the client runtime

- **WHEN** a feature requests same-origin navigation through the core client runtime
- **THEN** the core browser-navigation primitive preserves history and popstate behaviour
- **AND** the shell remains responsible for selecting and rendering the route
