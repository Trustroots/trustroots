# Member Profiles Specification

## Purpose

Allow members to present themselves to the Trustroots community and manage the
information shown on their profile.

## Requirements

### Requirement: Profile viewing

The system SHALL let signed-in members view their own profile and available
profiles of other members.

#### Scenario: Member views another available profile

- **WHEN** a signed-in member opens another available member's profile
- **THEN** the profile displays that member's public profile information

#### Scenario: Member opens an unavailable profile

- **WHEN** a signed-in member opens a profile that is not available to them
- **THEN** the system shows that the person is not available

### Requirement: Profile completion guidance

The system SHALL guide newly authenticated members to complete their profile.

#### Scenario: New member opens the welcome page

- **WHEN** a newly authenticated member opens the welcome page
- **THEN** the page provides a link to complete their profile

### Requirement: Profile editing

The system SHALL provide signed-in members with editing areas for their profile
description, account details, locations, networks, and profile photo.

#### Scenario: Member opens a profile editing area

- **WHEN** a signed-in member opens one of the supported profile editing areas
- **THEN** the corresponding editing form is available

### Requirement: Profile photo management

The system SHALL accept supported profile-photo uploads and explain when an
upload cannot be used.

#### Scenario: Member uploads a supported photo

- **WHEN** a signed-in member uploads a supported profile photo
- **THEN** the system updates their profile photo

#### Scenario: Member uploads an unsupported photo

- **WHEN** a signed-in member uploads an unsupported file as a profile photo
- **THEN** the system explains that the file type is not supported

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
