## ADDED Requirements

### Requirement: Hitchhiker names in ride popups

Ride popups SHALL show available non-empty hitchhiker nicknames before waiting time, preserving feed order and removing duplicate names. Named riders SHALL link directly to their Hitchwiki Maps account at `https://maps.hitchwiki.org/account/<nickname>`, with the nickname URL-encoded. Anonymous SHALL be plain text without a profile link. Missing and malformed names SHALL be omitted. Labels SHALL render safely as text, without gender symbols.

#### Scenario: Visitor inspects named and anonymous riders

- **WHEN** a visitor clicks an eligible ride origin containing named and Anonymous hitchhikers
- **THEN** the popup shows their names and links only named hitchhikers
- **AND** existing ride facts and the source ride link remain available

#### Scenario: Direct Maps account links

- **WHEN** a visitor opens a ride popup containing a named hitchhiker
- **THEN** their name links directly to the Hitchwiki Maps account
- **AND** no wiki user-page lookup is required
