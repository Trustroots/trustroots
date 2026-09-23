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

### Requirement: React profile viewing

The system SHALL render member profile views with the React application shell
while preserving the existing profile access and navigation behaviour.

#### Scenario: Member opens a profile tab

- **WHEN** an authenticated member opens a profile about, overview,
  accommodation, contacts, circles or experience-history URL
- **THEN** the React shell displays that tab and the profile navigation
- **AND** profile data and privacy rules continue to come from the existing APIs

#### Scenario: Member follows a profile action

- **WHEN** a member follows an edit, message, contact or experience-writing link
  from a profile view
- **THEN** the existing destination URL and access rule are retained

#### Scenario: Member opens an unavailable profile

- **WHEN** an authenticated member opens a profile that does not exist
- **THEN** the profile view displays the missing-member state

#### Scenario: Angular page links to a profile tab

- **WHEN** a member follows a named-state link from an Angular page
- **THEN** the browser opens the corresponding React-owned profile URL
