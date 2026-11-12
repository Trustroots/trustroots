## ADDED Requirements

### Requirement: Owned site header navigation

The web client SHALL render the site header with owned markup and the Support
and Profile dropdowns with the shared UI package. Desktop dropdown content SHALL
retain ordinary links and actions. The mobile navigation SHALL retain its
existing menu link.

#### Scenario: Open and dismiss a desktop dropdown

- **WHEN** a signed-in member activates a desktop dropdown with the keyboard
- **THEN** the dropdown opens and Tab reaches its first link
- **AND** Escape dismisses the dropdown and returns focus to its trigger

#### Scenario: Follow a Support link with the pointer

- **WHEN** a signed-in member hovers over the desktop Support trigger
- **THEN** the dropdown opens and stays open while the pointer moves to a link
