## ADDED Requirements

### Requirement: Servas profile links

Members SHALL be able to save or clear an optional Servas profile path in the hospitality network editor. Links SHALL use `https://servas.org/` and SHALL follow the existing visibility rules for external contact details.

#### Scenario: Save and view supported Servas paths

- **WHEN** a member saves a `household/fictional-host` or `address/fictional-host` path
- **THEN** the editor preview and profile sidebar link point to that path under `https://servas.org/`
- **AND** the path persists after reloading

#### Scenario: Clear a Servas link

- **WHEN** the member clears and saves the Servas field
- **THEN** the Servas sidebar link is absent

#### Scenario: Reject unsupported paths

- **WHEN** an update supplies a path outside `household/…` or `address/…`, or a path containing whitespace, a query, a fragment or a backslash
- **THEN** the update is rejected

#### Scenario: Hide external contact details

- **WHEN** existing profile visibility rules hide external contact details
- **THEN** the Servas path is omitted alongside other network identifiers
