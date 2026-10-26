## ADDED Requirements

### Requirement: Hitchhiker names in ride popups

Ride popups SHALL show available non-empty hitchhiker nicknames before waiting time, preserving feed order and removing duplicate names. Named riders SHALL link to their existing English Hitchwiki.org user page when available, falling back to their Hitchwiki Maps account. Anonymous SHALL be plain text without a profile link. Missing and malformed names SHALL be omitted. Labels SHALL render safely as text, without gender symbols.

#### Scenario: Visitor inspects named and anonymous riders

- **WHEN** a visitor clicks an eligible ride origin containing named and Anonymous hitchhikers
- **THEN** the popup shows their names and links only named hitchhikers
- **AND** existing ride facts and the source ride link remain available

#### Scenario: User page is missing or lookup fails

- **WHEN** a named hitchhiker has no English Hitchwiki.org user page or the lookup fails
- **THEN** their name links to the Hitchwiki Maps account
- **AND** the ride remains visible
