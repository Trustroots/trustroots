# Native Android Member App Specification

## ADDED Requirements

### Requirement: Feature-owned Android screen sources

Android member screens and their screen-specific helpers SHALL be organised
under feature packages below `ui`. Shared UI components and pure-data helpers
used by multiple screen features SHALL live in `ui/common` where appropriate.
The `TrustrootsApp`, member shell coordinator, and `Destination` enum SHALL
remain in the `ui` root. Source moves SHALL preserve existing rendering,
navigation, state ownership, ViewModels, resources, API behaviour, and UI
interactions.

#### Scenario: Contributor changes a moved screen

- **WHEN** a contributor changes a screen included in this source organisation
- **THEN** the screen entry point and screen-specific helpers reside in the
  corresponding feature package
- **AND** production and test references use the new package ownership
- **AND** former files do not retain forwarding screen functions

#### Scenario: Member uses an existing screen after source organisation

- **WHEN** a member uses any screen included in this source organisation
- **THEN** its existing rendering, navigation, state and interactions remain
  unchanged
