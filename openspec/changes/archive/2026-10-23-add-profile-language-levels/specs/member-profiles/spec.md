## ADDED Requirements

### Requirement: Optional profile language levels

Members SHALL be able to set Basic, Intermediate, Advanced or Native for each selected profile language, or leave its level unspecified. Profiles SHALL display declared levels beside the corresponding language names. Existing language selections SHALL remain unchanged without inferred levels.

#### Scenario: Set and display levels

- **WHEN** a member saves levels for selected languages
- **THEN** those levels persist and appear on their profile and messaging profile summary

#### Scenario: Clear a level or remove a language

- **WHEN** a member clears a level or removes its language
- **THEN** the corresponding level is removed

#### Scenario: Reject invalid level data

- **WHEN** a profile update includes an unsupported level, malformed level map or a level for an unselected language
- **THEN** the server rejects the update

#### Scenario: Preserve existing clients and profiles

- **WHEN** a profile has no declared levels or a client updates other profile fields
- **THEN** existing language selections and any saved levels are preserved
- **AND** removing languages through an existing client removes their saved levels
