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

The system SHALL keep avatar decoding bounded to a 10 MiB input, one frame,
dimensions no larger than 10,000 by 10,000 pixels, 40 megapixels, bounded
processor resources and time. It SHALL generate and validate all seven
thumbnails in private staging before publishing them in a server-generated
version directory. The server-owned version pointer SHALL change only after
publication succeeds, and a failed upload SHALL preserve the previous pointer
and files. Requests for staging paths SHALL be denied before public static file
serving. Members without a version pointer SHALL continue to use their existing
flat avatar paths.

#### Scenario: Member uploads a supported photo

- **WHEN** a signed-in member uploads a supported profile photo
- **THEN** the system updates their profile photo
- **AND** the profile points to the complete new thumbnail set

#### Scenario: Avatar processing fails during replacement

- **WHEN** processing or saving a new avatar fails
- **THEN** the previous avatar pointer and files remain available
- **AND** temporary input and unpublished output are cleaned up

#### Scenario: Member uploads an unsupported photo

- **WHEN** a signed-in member uploads an unsupported file as a profile photo
- **THEN** the system explains that the file type is not supported

#### Scenario: Image exceeds a processing bound

- **WHEN** a member uploads an image exceeding a configured dimension, frame or
  resource bound
- **THEN** the system rejects the upload and removes private temporary output
- **AND** the previous avatar remains available

#### Scenario: Avatar processing succeeds

- **WHEN** every required thumbnail is generated within the processing bounds
- **THEN** the system publishes the complete processed set with metadata removed

#### Scenario: Processing fails or times out

- **WHEN** thumbnail generation fails or reaches its time budget
- **THEN** the system stops processing and cleans private staging without
  publishing incomplete output

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

### Requirement: Targeted avatar-upload limits

The system SHALL enforce a configurable, shared request limit for authenticated avatar uploads using the account identity and a bounded window.

#### Scenario: Member exceeds the avatar-upload policy

- **WHEN** a member exceeds the configured avatar-upload limit within its window
- **THEN** the request is rejected with HTTP 429 and a `Retry-After` header

