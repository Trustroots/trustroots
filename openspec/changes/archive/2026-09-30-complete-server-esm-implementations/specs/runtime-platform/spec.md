## ADDED Requirements

### Requirement: Server production implementations use native ESM

Production implementations under `modules/*/server` SHALL use native `.mjs` modules while existing synchronous CommonJS entry paths remain available for consumers that have not migrated.

#### Scenario: Offer expiry is loaded through both module systems

- **WHEN** an ESM consumer imports the offer expiry implementation and a CommonJS consumer requires its existing `.js` path
- **THEN** both receive the same callable function and expiry behaviour

#### Scenario: A native server module introduces CommonJS syntax

- **WHEN** server `.mjs` files are linted
- **THEN** CommonJS exports and new dynamic `require()` calls are rejected except documented synchronous bootstrap and JSON-loading exceptions
