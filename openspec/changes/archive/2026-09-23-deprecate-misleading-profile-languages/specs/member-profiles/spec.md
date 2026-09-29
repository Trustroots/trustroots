## ADDED Requirements

### Requirement: Selectable profile languages

The system SHALL identify deprecated catalogue entries and prevent members from adding them as spoken profile languages while retaining existing selections.

#### Scenario: Member searches for a deprecated language

- **WHEN** a member searches the profile language picker for a deprecated entry
- **THEN** the entry is not offered as a new selection

#### Scenario: Member retains or removes an existing deprecated language

- **WHEN** a member already has a deprecated language and saves their profile with that language unchanged or removed
- **THEN** the update succeeds and any retained selection remains legible

#### Scenario: Member submits a new deprecated language directly

- **WHEN** a profile update adds a deprecated language that was not previously selected
- **THEN** the server rejects the update

#### Scenario: Member finds Limburgish

- **WHEN** the language catalogue is shown in English
- **THEN** the `lim` language is labelled Limburgish
