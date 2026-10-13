## ADDED Requirements

### Requirement: Desktop member navigation shortcuts

The signed-in desktop header SHALL show dropdowns on hover and keyboard focus. Circles SHALL list at most ten of the member's own circles, with Hackers first when joined and the remaining circles sorted by descending member count. Search SHALL offer “Find member by name” linking to `/search/members`. Primary Circles and Search links SHALL retain their destinations, and mobile navigation SHALL retain its existing behaviour.

#### Scenario: Member opens circle shortcuts

- **WHEN** a desktop member hovers over or focuses Circles
- **THEN** up to ten joined circles are available as links to circle detail pages, with Hackers first when joined and the remainder ordered by member count
- **AND** a member with no circles has no empty dropdown

#### Scenario: Member opens name search

- **WHEN** a desktop member hovers over or focuses Search
- **THEN** the member name search shortcut is available

#### Scenario: Member uses mobile navigation

- **WHEN** a member uses the header on a mobile viewport
- **THEN** Circles and Search retain their direct links without hover dropdowns
