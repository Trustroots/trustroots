## ADDED Requirements

### Requirement: Android profile experience count

The Android profile Experiences tab SHALL show the number of loaded experiences when that number is positive, and SHALL omit the count when it is zero.

#### Scenario: Profile has experiences

- **WHEN** a profile has loaded two experiences
- **THEN** its Experiences tab displays “Experiences (2)”

#### Scenario: Profile has no experiences

- **WHEN** a profile has no loaded experiences
- **THEN** its Experiences tab displays “Experiences” without a count
