## ADDED Requirements

### Requirement: Native ESM server runtime

The server SHALL use native ESM implementations for configuration, discovery, controllers, services, models, policies, routes, jobs and process entry points, without CommonJS implementation adapters.

#### Scenario: Application starts through its deployed launch command

- **WHEN** the server or worker starts on the supported Node 24 runtime
- **THEN** bootstrap awaits model registration before loading model-dependent modules
- **AND** routes, policies and background jobs retain their existing behaviour

#### Scenario: Server modules are verified

- **WHEN** linting and server coverage run
- **THEN** runtime modules cannot introduce CommonJS exports or dynamic requires
- **AND** native ESM implementations remain included in the existing 100 percent coverage gate

#### Scenario: Existing deployment configuration is loaded

- **WHEN** a deployment supplies its existing local configuration
- **THEN** the configuration is loaded through an explicit compatibility boundary
- **AND** production server implementations remain native ESM

## MODIFIED Requirements

### Requirement: Incremental server ESM interoperability

Server modules SHALL use native ESM. CommonJS test and build consumers SHALL load the native implementation paths through Node 24 interoperability.

#### Scenario: Existing consumer loads a migrated service

- **WHEN** a CommonJS server module loads a migrated service through its native implementation path
- **THEN** it receives the same callable exports and configuration values

#### Scenario: ESM consumer loads a migrated service

- **WHEN** an ESM server module imports the migrated service
- **THEN** it can use named exports without a CommonJS namespace adapter

Compatibility constraints: CommonJS test and build tooling SHALL use Node 24 native interoperability at the implementation path. Mutable service objects remain shared; named ESM exports are replaced at the import boundary by native module hooks. Server implementation adapters are removed.

### Requirement: Incremental server ESM services preserve CommonJS consumers

Each server service SHALL use a native ESM implementation without a CommonJS adapter. CommonJS test and build consumers SHALL use the native implementation path.

#### Scenario: CommonJS server code imports a migrated service

- **WHEN** a CommonJS consumer requires a native core or user service path
- **THEN** it receives the same callable or object export shape and behaviour

#### Scenario: ESM server code imports a migrated service

- **WHEN** an ESM consumer imports the implementation
- **THEN** it can access the service functions through named ESM exports

### Requirement: Migrated service objects preserve shared method replacements

Migrated spam, upload, statistics and Influx services SHALL expose named ESM functions and preserve the existing callable or mutable API through Node 24 interoperability. Where consumers replace service methods, the native CommonJS interoperability export SHALL return the same mutable object used by ESM consumers and internal dispatch.

#### Scenario: A consumer replaces an Influx method

- **WHEN** a CommonJS consumer replaces the Influx client hook or statistics submission method
- **THEN** measurement writing or statistics dispatch uses the replacement through the shared service object

#### Scenario: Existing service behaviour is exercised

- **WHEN** migrated services classify spam, validate uploads or record statistics
- **THEN** classifications, error responses, temporary-file cleanup and measurement payloads remain unchanged

#### Scenario: Both module systems load a service

- **WHEN** a CommonJS consumer requires the native implementation path and an ESM consumer imports the implementation
- **THEN** their default service objects are identical and the implementation provides named function exports without top-level await

### Requirement: Member interactions server ESM preserves registration and consumers

Server implementations in messages, contacts, experiences, offers, references-thread, tribes SHALL use native ESM without CommonJS implementation adapters, preserving export shapes and registration behaviour.

#### Scenario: Existing bootstrap loads migrated modules

- **WHEN** existing application bootstrap discovers and loads models, configuration, policies, routes or jobs in these domains
- **THEN** registration occurs exactly once in the existing order with unchanged names and callable signatures

#### Scenario: Existing consumers invoke migrated handlers

- **WHEN** controllers, services or tests load these domains through native implementation paths
- **THEN** handlers retain their behaviour, function context and shared mutable replacement semantics

#### Scenario: Migration regression checks run

- **WHEN** the migrated domains are validated
- **THEN** named exports are available for applicable ESM functions, coverage remains at the existing 100% baselines and existing end-to-end scenarios are retained

### Requirement: Identity platform server ESM preserves registration and consumers

Server implementations in users, core, sparkpost SHALL use native ESM without CommonJS implementation adapters, preserving export shapes and registration behaviour.

#### Scenario: Existing bootstrap loads migrated modules

- **WHEN** existing application bootstrap discovers and loads models, configuration, policies, routes or jobs in these domains
- **THEN** registration occurs exactly once in the existing order with unchanged names and callable signatures

#### Scenario: Existing consumers invoke migrated handlers

- **WHEN** controllers, services or tests load these domains through native implementation paths
- **THEN** handlers retain their behaviour, function context and shared mutable replacement semantics

#### Scenario: Migration regression checks run

- **WHEN** the migrated domains are validated
- **THEN** named exports are available for applicable ESM functions, coverage remains at the existing 100% baselines and existing end-to-end scenarios are retained

### Requirement: Administration server ESM preserves registration and consumers

Server implementations in admin, statistics, support, pages SHALL use native ESM without CommonJS implementation adapters, preserving export shapes and registration behaviour.

#### Scenario: Existing bootstrap loads migrated modules

- **WHEN** existing application bootstrap discovers and loads models, configuration, policies, routes or jobs in these domains
- **THEN** registration occurs exactly once in the existing order with unchanged names and callable signatures

#### Scenario: Existing consumers invoke migrated handlers

- **WHEN** controllers, services or tests load these domains through native implementation paths
- **THEN** handlers retain their behaviour, function context and shared mutable replacement semantics

#### Scenario: Migration regression checks run

- **WHEN** the migrated domains are validated
- **THEN** named exports are available for applicable ESM functions, coverage remains at the existing 100% baselines and existing end-to-end scenarios are retained

### Requirement: Server production implementations use native ESM

Production implementations under `modules/*/server` SHALL use native `.mjs` modules without CommonJS implementation adapters. CommonJS test and build consumers SHALL load the native implementation paths through Node 24 interoperability.

#### Scenario: Offer expiry is loaded through both module systems

- **WHEN** an ESM consumer imports the offer expiry implementation and a CommonJS consumer requires its native `.mjs` path
- **THEN** both receive the same callable function and expiry behaviour

#### Scenario: A native server module introduces CommonJS syntax

- **WHEN** server `.mjs` files are linted
- **THEN** CommonJS exports and new dynamic `require()` calls are rejected except documented synchronous bootstrap and JSON-loading exceptions

### Requirement: Production process entry implementations use native ESM

The server and background worker startup implementations SHALL use native ESM while retaining their existing `.js` launch commands.

#### Scenario: Existing server command starts the application

- **WHEN** deployment or local scripts run `node server.js`
- **THEN** the native ESM implementation starts the application through the existing app initialisation service

#### Scenario: Existing worker command starts background jobs

- **WHEN** deployment or local scripts run `node worker.js`
- **THEN** database connection, model loading, job unlock and worker start run in order with unchanged error handling
