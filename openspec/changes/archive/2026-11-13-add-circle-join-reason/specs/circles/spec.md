## ADDED Requirements

### Requirement: Circle join reason

A member joining a circle on the web SHALL be able to provide an optional reason of up to 160 characters on a single line. The system SHALL attach the reason to that membership and remove it when the member leaves.

The profile Circles tab SHALL show the reason to signed-in members who can view the profile.

#### Scenario: Member joins with a reason

- **WHEN** a member enters a valid reason and joins a circle
- **THEN** the system saves the reason on the new membership

#### Scenario: Member joins without a reason

- **WHEN** a member leaves the reason blank or joins from a client without the reason field
- **THEN** the system creates the membership without a reason

#### Scenario: Member leaves a circle

- **WHEN** a member leaves a circle
- **THEN** the membership and its join reason are removed

#### Scenario: Signed-in member views a profile

- **WHEN** a signed-in member opens the Circles tab of a profile they can access
- **THEN** the tab displays saved join reasons alongside their circles

#### Scenario: Guest requests a profile

- **WHEN** a guest requests profile data
- **THEN** the system excludes join reasons
