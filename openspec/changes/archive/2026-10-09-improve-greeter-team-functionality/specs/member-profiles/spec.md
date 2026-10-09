## ADDED Requirements

### Requirement: Public greeter recognition

The system SHALL derive an allowlisted `isGreeter` profile boolean from the current `welcome-team` role and show a Trustroots greeter badge linking to `/team/greeters`. This badge SHALL be independent of volunteer and alumni badges. It SHALL NOT expose the underlying private role collection.

#### Scenario: Greeter has another volunteer role

- **WHEN** a public greeter profile also qualifies for a volunteer badge
- **THEN** both badges appear with their respective links

#### Scenario: Greeter role is revoked

- **WHEN** the profile is retrieved after removal of `welcome-team`
- **THEN** it no longer displays the greeter badge
