# runtime-platform Specification

## Purpose

Define the supported JavaScript runtime platform and the verification required to keep development, automation, and production environments aligned.
## Requirements
### Requirement: Supported JavaScript runtime

The project SHALL require the Node.js 24 release line and npm 11 for development, dependency installation, automated tests, builds, and production execution.

#### Scenario: Developer checks the required runtime

- **WHEN** a developer selects the repository runtime through the documented version manager
- **THEN** Node.js 24 is selected and the environment check accepts npm 11

#### Scenario: Unsupported runtime is used

- **WHEN** dependency installation or the environment check runs with a Node.js or npm major version outside the supported platform
- **THEN** the command reports the version mismatch instead of silently treating that runtime as supported

### Requirement: Consistent automated environments

Development containers, CI jobs, end-to-end tests, and production images SHALL execute application code with Node.js 24 and install the npm 11 lockfile using `npm ci`.

#### Scenario: Clean automated installation

- **WHEN** an automated environment installs dependencies from a clean checkout
- **THEN** it uses Node.js 24, npm 11, and the committed lockfile without modifying the lockfile

#### Scenario: Production image is built

- **WHEN** the production container image is built
- **THEN** both its build stage and runtime stage use the maintained Passenger image that provides Node.js 24

### Requirement: Node.js 24-compatible build and native dependencies

The project SHALL build browser assets and load required native functionality on Node.js 24 without enabling OpenSSL's legacy provider or depending on Node.js 16-era node-gyp workarounds.

#### Scenario: Browser assets are built

- **WHEN** the production and end-to-end Webpack builds run on Node.js 24
- **THEN** they complete without `--openssl-legacy-provider`

#### Scenario: Server dependencies are installed

- **WHEN** server dependencies are installed in a clean Node.js 24 container
- **THEN** image processing and uploaded-file magic-byte detection are available without the deprecated `mmmagic` native binding

### Requirement: Behaviour-preserving verification

The runtime migration SHALL preserve existing application behaviour and SHALL NOT reduce client coverage, server coverage, or end-to-end coverage.

#### Scenario: Runtime upgrade is verified

- **WHEN** the Node.js 24 migration is ready for deployment
- **THEN** lint, client tests, server tests, production build, and end-to-end tests pass at the existing coverage baselines

#### Scenario: Application rollback is required

- **WHEN** a deployed Node.js 24 application image fails operational validation
- **THEN** operators can restore the previous application image without a database migration or data restore

### Requirement: Application commands do not depend on Gulp

The project SHALL start its server and worker and run server tests through npm scripts without requiring Gulp.

#### Scenario: Application startup

- **WHEN** a developer or deployment invokes an existing server or worker startup command
- **THEN** the process starts in the selected environment without loading Gulp

#### Scenario: Server test execution

- **WHEN** a developer invokes the server test command or its watch variant
- **THEN** database preparation, index creation, test execution, and cleanup occur without loading Gulp

### Requirement: Incremental server ESM interoperability

Server modules migrated to native ESM SHALL remain available to existing
CommonJS server consumers until those consumers are migrated.

#### Scenario: Existing consumer loads a migrated service

- **WHEN** a CommonJS server module loads a migrated service through its existing path
- **THEN** it receives the same callable exports and configuration values

#### Scenario: ESM consumer loads a migrated service

- **WHEN** an ESM server module imports the migrated service
- **THEN** it can use named exports without a CommonJS namespace adapter

Migration constraints: shims that expose ESM namespace objects provide read-only
exports, so tests must replace those dependencies at the import boundary instead
of stubbing named exports. Services that retain mutable object APIs can return a
shared default object through their CommonJS adapter. Migrated modules must avoid top-level await while
CommonJS consumers still use `require()`. Keep per-file `.mjs` modules and their
`.js` shims during the incremental migration; switch to package-wide ESM and
remove the shims only after the remaining CommonJS consumers have moved.

### Requirement: Incremental server ESM services preserve CommonJS consumers

Each server service migrated to ESM SHALL retain its current CommonJS import
path as an adapter until all consumers have migrated.

#### Scenario: CommonJS server code imports a migrated service

- **WHEN** a CommonJS consumer requires an existing core or user service path
- **THEN** it receives the same callable or object export shape and behaviour

#### Scenario: ESM server code imports a migrated service

- **WHEN** an ESM consumer imports the implementation
- **THEN** it can access the service functions through named ESM exports

### Requirement: Shared route authorisation middleware

The users, offers, messages, contacts, tribes and reference-thread callback-based route policies SHALL share role lookup and ACL response handling while preserving route grants, guest fallback, domain prechecks, ownership shortcuts and existing HTTP status and response bodies. The admin policy and asynchronous experiences policy remain outside this shared middleware.

#### Scenario: ACL allows a request

- **WHEN** one of the six policies evaluates a request after its domain prechecks
- **THEN** it checks the existing route grant for the user's roles, or `guest` when roles are absent, and calls the next handler only when allowed

#### Scenario: ACL denies or fails

- **WHEN** the ACL denies a request or reports an unexpected error
- **THEN** the policy returns its existing 403 denial or 500 error response, including its established JSON or send method

#### Scenario: Excluded policies

- **WHEN** the admin or asynchronous experiences policy evaluates a request
- **THEN** its existing authorisation and error handling remains in use

### Requirement: Migrated service objects preserve shared method replacements

Migrated spam, upload, statistics and Influx services SHALL expose named ESM functions and retain synchronous CommonJS adapters with the existing API. Where consumers replace service methods, the adapter SHALL return the same mutable object used by ESM consumers and internal dispatch.

#### Scenario: A consumer replaces an Influx method

- **WHEN** a CommonJS consumer replaces the Influx client hook or statistics submission method
- **THEN** measurement writing or statistics dispatch uses the replacement through the shared service object

#### Scenario: Existing service behaviour is exercised

- **WHEN** migrated services classify spam, validate uploads or record statistics
- **THEN** classifications, error responses, temporary-file cleanup and measurement payloads remain unchanged

#### Scenario: Both module systems load a service

- **WHEN** a CommonJS consumer requires the existing path and an ESM consumer imports the implementation
- **THEN** their default service objects are identical and the implementation provides named function exports without top-level await

### Requirement: Member interactions server ESM preserves registration and consumers

Server implementations in messages, contacts, experiences, offers, references-thread, tribes SHALL use native ESM while retaining existing synchronous CommonJS entry paths, export shapes and registration behaviour during incremental migration.

#### Scenario: Existing bootstrap loads migrated modules

- **WHEN** existing application bootstrap discovers and loads models, configuration, policies, routes or jobs in these domains
- **THEN** registration occurs exactly once in the existing order with unchanged names and callable signatures

#### Scenario: Existing consumers invoke migrated handlers

- **WHEN** controllers, services or tests load these domains through existing CommonJS paths
- **THEN** handlers retain their behaviour, function context and shared mutable replacement semantics

#### Scenario: Migration regression checks run

- **WHEN** the migrated domains are validated
- **THEN** named exports are available for applicable ESM functions, coverage remains at the existing 100% baselines and existing end-to-end scenarios are retained

### Requirement: Identity platform server ESM preserves registration and consumers

Server implementations in users, core, sparkpost SHALL use native ESM while retaining existing synchronous CommonJS entry paths, export shapes and registration behaviour during incremental migration.

#### Scenario: Existing bootstrap loads migrated modules

- **WHEN** existing application bootstrap discovers and loads models, configuration, policies, routes or jobs in these domains
- **THEN** registration occurs exactly once in the existing order with unchanged names and callable signatures

#### Scenario: Existing consumers invoke migrated handlers

- **WHEN** controllers, services or tests load these domains through existing CommonJS paths
- **THEN** handlers retain their behaviour, function context and shared mutable replacement semantics

#### Scenario: Migration regression checks run

- **WHEN** the migrated domains are validated
- **THEN** named exports are available for applicable ESM functions, coverage remains at the existing 100% baselines and existing end-to-end scenarios are retained

### Requirement: Administration server ESM preserves registration and consumers

Server implementations in admin, statistics, support, pages SHALL use native ESM while retaining existing synchronous CommonJS entry paths, export shapes and registration behaviour during incremental migration.

#### Scenario: Existing bootstrap loads migrated modules

- **WHEN** existing application bootstrap discovers and loads models, configuration, policies, routes or jobs in these domains
- **THEN** registration occurs exactly once in the existing order with unchanged names and callable signatures

#### Scenario: Existing consumers invoke migrated handlers

- **WHEN** controllers, services or tests load these domains through existing CommonJS paths
- **THEN** handlers retain their behaviour, function context and shared mutable replacement semantics

#### Scenario: Migration regression checks run

- **WHEN** the migrated domains are validated
- **THEN** named exports are available for applicable ESM functions, coverage remains at the existing 100% baselines and existing end-to-end scenarios are retained

### Requirement: Server production implementations use native ESM

Production implementations under `modules/*/server` SHALL use native `.mjs` modules while existing synchronous CommonJS entry paths remain available for consumers that have not migrated.

#### Scenario: Offer expiry is loaded through both module systems

- **WHEN** an ESM consumer imports the offer expiry implementation and a CommonJS consumer requires its existing `.js` path
- **THEN** both receive the same callable function and expiry behaviour

#### Scenario: A native server module introduces CommonJS syntax

- **WHEN** server `.mjs` files are linted
- **THEN** CommonJS exports and new dynamic `require()` calls are rejected except documented synchronous bootstrap and JSON-loading exceptions
