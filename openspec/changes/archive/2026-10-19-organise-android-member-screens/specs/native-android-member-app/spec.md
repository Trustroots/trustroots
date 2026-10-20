## ADDED Requirements

### Requirement: Screen-scoped Android member sources

The Android member search, profile detail, profile editing, inbox, conversation
and contacts screens SHALL each have a named package below `ui` with a separate
screen entry-point file. Components and helpers shared across those screens
SHALL live in `ui/common`. Source organisation changes SHALL preserve existing
screen state, navigation callbacks, API behaviour and UI interactions.

#### Scenario: Maintaining one member screen

- **WHEN** a contributor changes one of these Android member screens
- **THEN** its entry point is in that screen's package
- **AND** shared components are available through `ui/common`

#### Scenario: Existing member journeys after source extraction

- **WHEN** a member searches, opens a profile, edits their profile, reads an
  inbox, opens a conversation or browses contacts after source extraction
- **THEN** the existing interactions and Back callbacks remain unchanged
- **AND** existing Android journey coverage remains in place
