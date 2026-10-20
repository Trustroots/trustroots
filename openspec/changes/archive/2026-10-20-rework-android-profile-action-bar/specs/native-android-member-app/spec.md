## MODIFIED Requirements

### Requirement: Stable native Android profile frame

The Android member profile SHALL use one shared artwork header with section
tabs. The artwork and scrim SHALL extend behind the profile action area to the
top system inset, with controls remaining readable over the artwork. The
action area SHALL keep Back on the left and, for another member's profile, a
primary Send a message action on the right. Experience-sharing and contact
actions SHALL be reachable from an accessible overflow menu. A member's own
profile SHALL retain its edit action. Existing contact relationship states,
add-contact routing, and remove confirmation SHALL be preserved. The header
and tabs SHALL remain outside the `HorizontalPager`, which contains only
scrollable section content. Tab selection and pager swipes SHALL stay
synchronised. The avatar SHALL retain a minimum 48 dp touch target. On compact
screens, the header SHALL use a horizontal avatar and text layout and preserve
usable section space after system insets.

#### Scenario: Member opens another member's profile

- **WHEN** a member views another member's profile
- **THEN** Back is available on the left and Send a message is the primary
  action on the right
- **AND** experience sharing and the applicable contact action are available
  from an accessible overflow menu
- **AND** the artwork continues behind the action area up to the top system
  inset

#### Scenario: Member scrolls a profile section

- **WHEN** a member scrolls the About, Contacts or Experiences content
- **THEN** the profile actions, artwork header and section tabs remain visible
- **AND** only the current section content scrolls

#### Scenario: Member swipes between profile sections

- **WHEN** a member swipes the section pager
- **THEN** the newly selected section is shown
- **AND** its tab is selected while the shared header and tab row remain in one
  place

#### Scenario: Member sees section tabs over the profile artwork

- **WHEN** a member views a loaded profile
- **THEN** the section tabs are inside the artwork header
- **AND** the profile background image and scrim continue behind the tabs
- **AND** the tabs remain legible against the scrim

#### Scenario: Member manages a contact relationship from the profile

- **WHEN** the contact relationship is loading, absent, pending or confirmed
- **THEN** the overflow menu reflects the existing applicable contact action
- **AND** add-contact routing and removal confirmation retain their existing
  behaviour

#### Scenario: Member opens their own profile

- **WHEN** a member views their own profile
- **THEN** the edit action remains available
- **AND** message, experience-sharing and contact actions for other members
  are not presented

#### Scenario: Member opens a profile in a compact viewport

- **WHEN** the profile viewport is 360 dp tall with a 24 dp top inset and an
  80 dp bottom inset
- **THEN** the shared artwork header, action area and tabs leave at least
  96 dp available for scrollable section content
- **AND** the artwork reaches behind the action area and top inset

#### Scenario: Member opens a profile in a shorter viewport

- **WHEN** the profile viewport is 320 dp tall with a 24 dp top inset and an
  80 dp bottom inset
- **THEN** at least 48 dp remain available for scrollable section content
- **AND** the avatar and action controls retain their minimum touch targets

#### Scenario: Profile is loading or fails to load

- **WHEN** the profile request is pending or fails
- **THEN** the loading or error state remains available without a partial
  interactive profile frame

#### Scenario: Member opens and closes the profile photo viewer

- **WHEN** a member opens a profile photo and then closes the viewer
- **THEN** the existing image-viewer state and callbacks are preserved
- **AND** the same profile and selected section remain visible
