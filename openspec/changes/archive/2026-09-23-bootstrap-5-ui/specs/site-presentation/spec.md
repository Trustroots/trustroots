## ADDED Requirements

### Requirement: Responsive client presentation

The system SHALL render the React client with Bootstrap 5 styles and supported
React Bootstrap components while retaining responsive navigation and usable
forms, dialogs, tabs and page layouts.

#### Scenario: Visitor opens a page on a narrow viewport

- **WHEN** a visitor opens a public or member page on a narrow viewport
- **THEN** navigation and page content remain available without horizontal overflow

#### Scenario: Member uses an interactive widget

- **WHEN** a member opens a dialog, changes a tab or uses a navigation menu
- **THEN** the widget responds to the member's action and remains accessible
