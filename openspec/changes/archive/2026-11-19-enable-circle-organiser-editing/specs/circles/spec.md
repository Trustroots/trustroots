## ADDED Requirements

### Requirement: Automatic links in circle descriptions

Circle pages and description previews SHALL turn plain web addresses into links while preserving supported formatting and existing safe links.

#### Scenario: A description contains a bare domain

- **WHEN** a reader opens a circle whose description contains a bare domain
- **THEN** the address is a clickable HTTPS link

### Requirement: Organiser circle editing

The system SHALL let eligible signed-in organisers edit the name and description of a visible circle to which they are currently assigned. The system SHALL keep the circle URL stable and reserve other catalogue controls for administrators.

#### Scenario: An assigned organiser edits their circle

- **WHEN** an assigned organiser opens their circle and saves a valid name and description
- **THEN** the updated details are visible at the same circle URL

#### Scenario: A member lacks an active assignment

- **WHEN** a member attempts to edit a circle without a current organiser assignment
- **THEN** the system denies the update

## MODIFIED Requirements

### Requirement: Circle organisers

The system SHALL show linked organiser names on the web circle detail page to signed-in members who can view the circle and the listed profiles. The organiser designation SHALL be independent of circle membership.

#### Scenario: Signed-in member views a circle with organisers

- **WHEN** a signed-in member opens a circle with eligible organisers
- **THEN** the circle page shows the organisers' current names linked to their profiles
- **AND** joining or leaving the circle preserves the organiser section

#### Scenario: Organisers are unavailable to the viewer

- **WHEN** a guest opens a circle or a signed-in viewer has no eligible organisers to see
- **THEN** the page omits the organiser section
- **AND** the detail API omits organiser identities the viewer cannot access

#### Scenario: Organiser identities are scoped to circle details

- **WHEN** a client requests the circle catalogue or a circle membership payload
- **THEN** the response excludes organiser assignments

### Requirement: Circle editor navigation and preview

The editor SHALL select a circle using `/admin/circles/{slug}` and link to its
public page. Public circle pages SHALL link to the administrator editor for users with the
admin role. Circle descriptions SHALL preserve safe links, and the editor SHALL
show a sanitised live preview of the description.

#### Scenario: Administrator selects a circle

- **WHEN** an administrator selects a circle or directly opens its editor URL
- **THEN** the URL identifies that circle by slug and the editor loads it
- **AND** its public circle link is available

#### Scenario: Administrator edits a description

- **WHEN** the administrator changes description HTML
- **THEN** the editor previews safe formatting and link destinations
- **AND** unsupported markup and unsafe link destinations are removed

#### Scenario: Member views a circle

- **WHEN** a user views a circle
- **THEN** its administrator edit link is visible to users with the admin role
