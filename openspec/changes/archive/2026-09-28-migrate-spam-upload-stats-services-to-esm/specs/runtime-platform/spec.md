## ADDED Requirements

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
