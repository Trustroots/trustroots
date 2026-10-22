## MODIFIED Requirements

### Requirement: Screen-scoped Android member sources

Android member screen entry points and screen-specific helpers SHALL be
organised under named feature packages below `ui`, including the existing
member search, profile detail, profile editing, inbox, conversation and
contacts screens, and the integrated Circles, HostDetail, HostMap, HostOffer,
Search, Account, Experience, Menu and Startup screens. Components and helpers
shared across screen features SHALL live in `ui/common` where appropriate.
`TrustrootsApp`, `Destination`, `MemberTabVisit`, `MemberShellVisit` and the
`MemberShell` coordinator SHALL remain in the `ui` root. Source organisation
changes SHALL preserve existing rendering, navigation and route state,
ViewModel ownership and lifetime, callbacks, resources, API behaviour and UI
interactions. All existing unit and Android journey tests and their assertions
SHALL remain in place, with feature ViewModel tests located in their owning feature package and
established Android journeys retaining their integration package. Already
published serialisable route types SHALL retain their Java class names because
Navigation 3 persists those names in Android SavedState, including the existing
Menu page/browser keys and their enum values.

#### Scenario: Maintaining one member screen

- **WHEN** a contributor changes an Android member screen included in this
  source organisation
- **THEN** its entry point and screen-specific helpers reside in the owning
  feature package
- **AND** shared UI components reside in `ui/common` where appropriate
- **AND** production and test references use explicit imports for the new
  package ownership
- **AND** former files contain no forwarding screen functions or compatibility
  aliases

#### Scenario: Existing member journeys after source extraction

- **WHEN** a member uses any Android screen included in this source organisation
- **THEN** its existing rendering, navigation, state ownership, ViewModels,
  resources, API behaviour and interactions remain unchanged
- **AND** all existing unit and Android journey test methods, assertions and
  counts remain in place

#### Scenario: Restoring published Menu routes after source organisation

- **GIVEN** Android SavedState contains a supported Menu page or browser route
- **WHEN** Navigation 3 restores the stack after the source organisation
- **THEN** the original `org.trustroots.android.ui` route class names resolve
- **AND** legacy EditProfile and omitted support-link values remain supported
- **AND** translated titles, URLs and session cookies are resolved at runtime
