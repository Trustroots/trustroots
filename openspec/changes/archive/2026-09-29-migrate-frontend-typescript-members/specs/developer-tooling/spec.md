## ADDED Requirements

### Requirement: Member-facing client modules use strict TypeScript
The users, contacts, tribes, experiences and references-thread client modules SHALL use `.ts` or `.tsx` for all production modules included in the migration, with meaningful types that pass the project TypeScript checks without suppressing diagnostics.

#### Scenario: Migrated member modules are type-checked
- **WHEN** the project TypeScript check runs
- **THEN** every migrated production module is included in the check and passes without blanket `any` types or TypeScript suppression comments

#### Scenario: Existing member-facing imports remain compatible
- **WHEN** an existing client module imports a migrated module using its prior extensionless or explicit `.js` path
- **THEN** client bundling and tests resolve the converted module with the same runtime behaviour

#### Scenario: Existing client coverage remains intact
- **WHEN** client tests and coverage run after migration
- **THEN** existing tests continue to exercise the migrated functionality and coverage thresholds remain unchanged
