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

The desktop primary navigation SHALL show an Admin link to `/admin` immediately
before Circles when the signed-in member has the admin role. Other members,
including welcome-team members, SHALL not see the link.

#### Scenario: Administrator opens the header

- **WHEN** a signed-in administrator views the desktop header
- **THEN** Admin appears immediately before Circles and links to `/admin`

#### Scenario: Member without admin rights

- **WHEN** a signed-in member without the admin role views the header
- **THEN** no Admin shortcut is displayed
