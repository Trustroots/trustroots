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

Migration constraints: CommonJS shims expose read-only ESM namespace objects,
so tests must replace a migrated dependency at the import boundary instead of
stubbing its named exports. Migrated modules must avoid top-level await while
CommonJS consumers still use `require()`. Keep per-file `.mjs` modules and their
`.js` shims during the incremental migration; switch to package-wide ESM and
remove the shims only after the remaining CommonJS consumers have moved.
