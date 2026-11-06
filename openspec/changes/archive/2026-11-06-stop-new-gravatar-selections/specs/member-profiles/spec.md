## ADDED Requirements

### Requirement: Gravatar transition

The system SHALL prevent members from starting or resuming Gravatar usage through the UI, profile API or avatar source override. It SHALL preserve existing Gravatar selections and images during the transition, allow unrelated profile updates and allow switching to an uploaded photo or no photo. New accounts SHALL default to no photo. Existing images SHALL NOT be migrated or removed until the retirement approach, member communication and completion criteria are agreed.

#### Scenario: Member without Gravatar edits their photo

- **WHEN** a member whose current source is not Gravatar opens photo settings
- **THEN** Gravatar is not offered
- **AND** a direct profile API request selecting Gravatar is rejected

#### Scenario: Existing Gravatar member saves their profile

- **WHEN** a current Gravatar member retains that source or saves unrelated changes
- **THEN** the update succeeds and their image is preserved

#### Scenario: Existing Gravatar member switches away

- **WHEN** a current Gravatar member selects no photo or an uploaded photo
- **THEN** the update succeeds
- **AND** Gravatar is no longer offered or accepted by the profile API
