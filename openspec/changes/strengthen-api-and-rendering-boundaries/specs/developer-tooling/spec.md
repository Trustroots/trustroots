## ADDED Requirements

### Requirement: Enforced API and rendering boundaries

CI SHALL enforce reviewed direct HTML rendering sites and run fast API boundary
regressions for internal and fork pull requests without requiring write permissions
for those checks.
API request objects SHALL reject reserved database operator, field-path and
prototype keys before route handlers. String values SHALL remain unchanged.
Staff username lookup SHALL accept only string usernames.

#### Scenario: New direct HTML rendering site is introduced

- **WHEN** a change adds direct HTML rendering outside the reviewed sites
- **THEN** lint fails in CI

#### Scenario: API input contains a reserved object key

- **WHEN** parsed API body or query input contains a reserved key at any depth
- **THEN** the server returns HTTP 400 before executing the route handler

#### Scenario: API input contains ordinary text

- **WHEN** an API string value contains punctuation or markup
- **THEN** the input boundary leaves that string unchanged
