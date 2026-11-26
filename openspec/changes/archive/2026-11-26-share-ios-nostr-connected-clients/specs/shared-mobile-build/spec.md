## ADDED Requirements

### Requirement: Shared iOS Nostranslation connected client rows

The regular iOS Nostranslation signing sheet SHALL use shared Compose to render each connected client's label and revoke control. Swift SHALL supply only the displayed public-key prefix and handle each callback using the existing account-scoped signer.

#### Scenario: Viewing connected clients

- **WHEN** the member has paired Nostranslation clients for their active account and key
- **THEN** iOS shows the connected-client section with each client's public-key prefix and a corresponding accessible revoke control

#### Scenario: Revoking a connected client

- **WHEN** a member revokes a displayed client
- **THEN** the iOS signer applies its existing account-scoped revocation operation to that client
- **AND** the connected-client section reflects the resulting native client list

#### Scenario: Opening signing with no connected clients

- **WHEN** the member opens the signing sheet without any connected clients for their active account and key
- **THEN** the connected-client section and its revoke controls are hidden
