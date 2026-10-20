## ADDED Requirements

### Requirement: Collapsing headers on remaining member destinations

The Android Profile destination, Contacts overview, Account screen, and own
and member profile screens SHALL compact their tall headers as the member
scrolls, leaving more space for the active content. Back navigation and
existing screen actions SHALL remain available and retain their current
behaviour. Header and content layout SHALL respect the supplied system insets.

#### Scenario: Member scrolls the Profile destination

- **WHEN** a member scrolls the Profile destination
- **THEN** the `Profile` title compacts into a persistent app bar
- **AND** the member identity and destination links remain available in the
  scrollable content

#### Scenario: Member scrolls Contacts or Account

- **WHEN** a member scrolls the Contacts overview or Account screen
- **THEN** the screen header compacts to make more vertical room for its content
- **AND** Back remains reachable
- **AND** Account form values, dirty-state guard, and in-flight save behaviour
  remain unchanged

#### Scenario: Member scrolls their own profile

- **WHEN** a member scrolls their own profile
- **THEN** the profile artwork header compacts while the edit action remains
  available
- **AND** the member name and edit action share a single compact row above
  the fixed profile tabs
- **AND** the selected profile section and its scroll position are preserved

#### Scenario: Member scrolls another member's profile

- **WHEN** a member scrolls another member's profile
- **THEN** the artwork continues behind the status inset and profile action
  area as the frame compacts
- **AND** the member name and actions share a single compact row above the tabs
- **AND** Back remains on the left and Send a message remains the primary
  action on the right
- **AND** applicable contact and experience actions remain available through
  the overflow menu
- **AND** profile tabs remain fixed outside the pager, over the artwork, and
  synchronised with pager swipes

#### Scenario: Member views a profile with system insets

- **WHEN** a member opens or scrolls a profile with status or navigation
  insets
- **THEN** the artwork, actions, tabs, and content avoid duplicate or missing
  inset space
- **AND** action touch targets remain accessible
