## ADDED Requirements

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
