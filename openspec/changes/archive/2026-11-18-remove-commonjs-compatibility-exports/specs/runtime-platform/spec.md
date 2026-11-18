## ADDED Requirements

### Requirement: No CommonJS compatibility exports

Modules SHALL NOT export a binding named `module.exports`. Server tests SHALL load application modules and test utilities through ESM imports or the ESM `mockModule` helper, and SHALL NOT test CommonJS interoperability. CommonJS files that remain, such as the mobile module's `.cjs` sources and tool scripts or configuration files, SHALL read an ES module's `default` export. Lint SHALL reject a `module.exports` export in any file.

#### Scenario: A compatibility export returns

- **WHEN** any file adds an `export { … as 'module.exports' }` or re-exports that name
- **THEN** lint fails

#### Scenario: Server tests exercise a module

- **WHEN** the server test suite runs
- **THEN** its test files are `.mts` files that import application modules through ESM, or import a mocked copy through `mockModule`

#### Scenario: A remaining CommonJS file loads an ES module

- **WHEN** a mobile `.cjs` source, script or configuration file requires an ES module
- **THEN** it uses the module's `default` export, which is the same object ESM consumers import

## MODIFIED Requirements

### Requirement: Migrated service objects preserve shared method replacements

Migrated upload, statistics and Influx services SHALL expose named ESM functions and a default service object. Where consumers replace service methods, they SHALL replace them on that default object, which internal dispatch also uses.

#### Scenario: A consumer replaces an Influx method

- **WHEN** a consumer replaces the Influx client hook or statistics submission method on the default service object
- **THEN** measurement writing or statistics dispatch uses the replacement through the shared service object

#### Scenario: Existing service behaviour is exercised

- **WHEN** migrated services validate uploads or record statistics
- **THEN** error responses, temporary-file cleanup and measurement payloads remain unchanged

### Requirement: Member interactions server ESM preserves registration and consumers

Server implementations in messages, contacts, experiences, offers, references-thread, tribes SHALL use native ESM with ordinary ESM exports while preserving their export shapes and registration behaviour.

#### Scenario: Existing bootstrap loads migrated modules

- **WHEN** existing application bootstrap discovers and loads models, configuration, policies, routes or jobs in these domains
- **THEN** registration occurs exactly once in the existing order with unchanged names and callable signatures

#### Scenario: Existing consumers invoke migrated handlers

- **WHEN** controllers, services or tests import these domains through ESM
- **THEN** handlers retain their behaviour, function context and shared mutable replacement semantics

#### Scenario: Migration regression checks run

- **WHEN** the migrated domains are validated
- **THEN** named exports are available for applicable ESM functions, coverage remains at the existing 100% baselines and existing end-to-end scenarios are retained

### Requirement: Identity platform server ESM preserves registration and consumers

Server implementations in users, core, sparkpost SHALL use native ESM with ordinary ESM exports while preserving their export shapes and registration behaviour.

#### Scenario: Existing bootstrap loads migrated modules

- **WHEN** existing application bootstrap discovers and loads models, configuration, policies, routes or jobs in these domains
- **THEN** registration occurs exactly once in the existing order with unchanged names and callable signatures

#### Scenario: Existing consumers invoke migrated handlers

- **WHEN** controllers, services or tests import these domains through ESM
- **THEN** handlers retain their behaviour, function context and shared mutable replacement semantics

#### Scenario: Migration regression checks run

- **WHEN** the migrated domains are validated
- **THEN** named exports are available for applicable ESM functions, coverage remains at the existing 100% baselines and existing end-to-end scenarios are retained

### Requirement: Administration server ESM preserves registration and consumers

Server implementations in admin, statistics, support, pages SHALL use native ESM with ordinary ESM exports while preserving their export shapes and registration behaviour.

#### Scenario: Existing bootstrap loads migrated modules

- **WHEN** existing application bootstrap discovers and loads models, configuration, policies, routes or jobs in these domains
- **THEN** registration occurs exactly once in the existing order with unchanged names and callable signatures

#### Scenario: Existing consumers invoke migrated handlers

- **WHEN** controllers, services or tests import these domains through ESM
- **THEN** handlers retain their behaviour, function context and shared mutable replacement semantics

#### Scenario: Migration regression checks run

- **WHEN** the migrated domains are validated
- **THEN** named exports are available for applicable ESM functions, coverage remains at the existing 100% baselines and existing end-to-end scenarios are retained

### Requirement: Server production implementations use native ESM

Production implementations under `modules/*/server` SHALL use native ES modules. The mobile module's `.cjs` sources remain CommonJS until they are migrated.

#### Scenario: Offer expiry is imported

- **WHEN** an ESM consumer imports the offer expiry implementation
- **THEN** it receives the callable function and its expiry behaviour

#### Scenario: A native server module introduces CommonJS syntax

- **WHEN** server `.mjs` files are linted
- **THEN** CommonJS exports and new dynamic `require()` calls are rejected except documented synchronous bootstrap and JSON-loading exceptions

## REMOVED Requirements

### Requirement: Incremental server ESM interoperability

**Reason**: No CommonJS server consumer requires an ES module's `module.exports` export any more.
**Migration**: Import ES modules through ESM; remaining CommonJS files read the `default` export.

### Requirement: Incremental server ESM services preserve CommonJS consumers

**Reason**: Services no longer keep CommonJS adapters; their consumers import them through ESM.
**Migration**: Import the service implementation and use its default object or named exports.
