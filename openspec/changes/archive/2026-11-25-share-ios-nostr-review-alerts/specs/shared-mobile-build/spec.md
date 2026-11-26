## ADDED Requirements

### Requirement: Regular iOS Nostranslation review alert controls use Compose

The regular iOS signing sheet SHALL use shared Compose for the review alert
action and status when the active account has a connected Nostranslation
client. The iOS host SHALL handle notification permission, registration and
account scoping through the existing alert manager.

#### Scenario: Open the signing sheet without connected clients

- **GIVEN** an active account has a local Nostr key and no connected clients
- **WHEN** the member opens the Nostranslation signing sheet
- **THEN** the review alert controls are unavailable until a client is connected
