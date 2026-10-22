## ADDED Requirements

### Requirement: Circle editor navigation and preview

The editor SHALL select a circle using `/admin/circles/{slug}` and link to its
public page. Public circle pages SHALL link to their editor for users with the
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
- **THEN** its edit link is visible only if the user has the admin role
