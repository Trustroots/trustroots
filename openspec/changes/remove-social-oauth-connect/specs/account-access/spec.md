# Account Access Specification (delta)

## MODIFIED Requirements

### Requirement: Connected accounts and push registrations

The system SHALL let authenticated account holders remove legacy OAuth
provider data and manage their push-notification registrations. The system
SHALL NOT offer new Facebook, GitHub, or Twitter connections.

#### Scenario: Account holder disconnects a legacy OAuth provider

- **WHEN** an authenticated account holder disconnects Facebook, GitHub, or Twitter
- **THEN** the system removes the provider data from their account

#### Scenario: Account holder manages a push registration

- **WHEN** an authenticated account holder adds or removes a push registration
- **THEN** the system persists the requested registration state

#### Scenario: Social OAuth is not offered

- **WHEN** an authenticated account holder views the networks edit page
- **THEN** the system does not offer Facebook, GitHub, or Twitter as a new connection

#### Scenario: Previously connected provider data remains usable

- **WHEN** a member connected a social provider before the feature was removed
- **THEN** the system retains their stored provider data
- **AND** continues to support a selected Facebook avatar
- **AND** shows the legacy connection below Save in account settings
- **AND** lets them delete the stored provider data
