# Member Navigation Specification

## Purpose

Help signed-in members navigate to the main areas of their Trustroots account
and end their session safely.

## Requirements

### Requirement: Member navigation page

The system SHALL provide signed-in members with a navigation page containing
shortcuts to their profile, profile editing, and member search.

#### Scenario: Member opens the navigation page

- **WHEN** a signed-in member opens the navigation page
- **THEN** the page displays shortcuts to view their profile, edit their profile, and find people

### Requirement: Navigation sign-out

The system SHALL let a signed-in member end their session from the navigation
experience.

#### Scenario: Member signs out from navigation

- **WHEN** a signed-in member selects sign out from the navigation experience
- **THEN** the system clears the member's session
- **AND** member-only routes require the member to sign in again
