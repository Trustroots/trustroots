## ADDED Requirements

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
