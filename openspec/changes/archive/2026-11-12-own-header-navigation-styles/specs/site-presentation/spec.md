## ADDED Requirements

### Requirement: Site-owned header navigation styles

The web client SHALL style its fixed header, navigation lists and dropdown
panels using site-owned styles. The header SHALL preserve its responsive
navigation and show keyboard focus in its desktop dropdowns.

#### Scenario: Open a desktop navigation panel

- **WHEN** a member opens a header dropdown on desktop
- **THEN** the panel is positioned next to its trigger using the document direction
- **AND** its links remain legible and keyboard focus is visible

#### Scenario: Read the profile dropdown's information links

- **WHEN** the information links are wider than the profile panel
- **THEN** they wrap onto additional rows within the panel
- **AND** the information links omit Foundation and Media

#### Scenario: Use navigation on a narrow screen

- **WHEN** a member uses the site on a narrow screen
- **THEN** the header stays fixed and the mobile navigation links remain visible
