## ADDED Requirements

### Requirement: Regular iOS profile uses shared contact rows

The regular iOS profile SHALL render its contact list with the shared Compose
row and the existing iOS avatar. It SHALL initially show up to six contacts
and allow the member to show more and collapse the list. A contact with a
username SHALL open the native member profile.

#### Scenario: Browse contacts from My profile

- **GIVEN** a member has more than six contacts
- **WHEN** they expand the list and then select one of their contacts
- **THEN** the full list is available and the contact's profile opens
- **AND** returning allows the member to collapse the list
