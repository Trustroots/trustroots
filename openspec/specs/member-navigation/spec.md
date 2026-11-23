# Member Navigation Specification

## Purpose

Help signed-in members navigate to the main areas of their Trustroots account
and end their session safely.

## Requirements

### Requirement: Member navigation page

The system SHALL provide signed-in members with a navigation page containing
shortcuts to their profile, profile editing, member search, public statistics,
and safety guidance.

#### Scenario: Member opens the navigation page

- **WHEN** a signed-in member opens the navigation page
- **THEN** the page displays shortcuts to view their profile, edit their
  profile, find people, view public statistics, and read safety guidance

### Requirement: Navigation sign-out

The system SHALL let a signed-in member end their session from the navigation
experience.

#### Scenario: Member signs out from navigation

- **WHEN** a signed-in member selects sign out from the navigation experience
- **THEN** the system clears the member's session
- **AND** member-only routes require the member to sign in again

### Requirement: Administrator header shortcut

The desktop primary navigation SHALL show an Admin link immediately before
Circles when the signed-in member has the admin or `welcome-team` role. A
welcome-team member's link SHALL go directly to `/admin/acquisition-stories`;
other administrators' link SHALL go to `/admin`.

#### Scenario: Administrator opens the header

- **WHEN** a signed-in administrator without the welcome-team role views the desktop header
- **THEN** Admin appears immediately before Circles and links to `/admin`

#### Scenario: Welcome team member opens the header

- **WHEN** a signed-in welcome-team member views the desktop header
- **THEN** Admin appears immediately before Circles and links to `/admin/acquisition-stories`

#### Scenario: Member without staff access

- **WHEN** a signed-in member without the admin or welcome-team role views the header
- **THEN** no Admin shortcut is displayed

### Requirement: Record safety page visits

The system SHALL record a private visit flag for a signed-in member who opens the web safety page. The flag SHALL persist across sessions and record only that the page was opened.

#### Scenario: A signed-in member opens the safety page

- **WHEN** a signed-in member opens `/safety`
- **THEN** the system marks that member's account as having visited the safety page
- **AND** repeat visits leave the member marked as having visited

#### Scenario: A visitor opens the safety page

- **WHEN** someone who is signed out opens `/safety`
- **THEN** the guidance is available
- **AND** no account visit is recorded

#### Scenario: The visit cannot be recorded

- **WHEN** the visit request fails
- **THEN** the guidance remains available to the member
