## ADDED Requirements

### Requirement: Regular iOS Contacts uses Compose

The regular iOS Contacts screen SHALL use Compose to show contacts, avatars
and pending confirmations. It SHALL use the existing iOS API, keep loading
and empty states and provide a retry action when the request fails. Contacts
with a username SHALL open the existing iOS profile.

#### Scenario: Open a contact’s profile

- **GIVEN** a signed-in member opens Contacts
- **WHEN** they select a contact with a username
- **THEN** the existing iOS profile opens for that contact
