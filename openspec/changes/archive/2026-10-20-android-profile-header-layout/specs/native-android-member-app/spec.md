## ADDED Requirements

### Requirement: Stable native Android profile frame

The Android member profile SHALL use one shared artwork header with section
tabs. Profile actions SHALL remain above it; the artwork image and scrim SHALL
extend behind legible tabs. The header and tabs SHALL remain outside the
`HorizontalPager`, which contains only scrollable section content. Tab selection
and pager swipes SHALL stay synchronised. On compact screens, the header SHALL
use a horizontal avatar and text layout and preserve usable section space after
bottom insets.

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

#### Scenario: Member opens a profile in a compact viewport

- **WHEN** the profile viewport is 360 dp tall with a 24 dp top inset and an
  80 dp bottom inset
- **THEN** the artwork header uses a compact horizontal presentation
- **AND** at least 96 dp remain available for section content after bottom
  padding
- **AND** the section remains vertically scrollable

#### Scenario: Member opens a profile in a shorter viewport

- **WHEN** the profile viewport is 320 dp tall with a 24 dp top inset and an
  80 dp bottom inset
- **THEN** the compact header keeps at least 48 dp available for section
  content after bottom padding
- **AND** the section remains vertically scrollable

#### Scenario: Profile is loading or fails to load

- **WHEN** the profile request is pending or fails
- **THEN** the loading or error state remains available without a partial
  interactive profile frame
