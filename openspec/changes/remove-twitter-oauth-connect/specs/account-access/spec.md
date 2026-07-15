# Account Access Specification (delta)

## MODIFIED Requirements

### Requirement: Connected accounts and push registrations

The system SHALL let authenticated account holders connect Facebook or GitHub
accounts, remove connected OAuth provider data (including previously connected
Twitter data), and manage their push-notification registrations. The system
SHALL NOT offer new Twitter connections.

#### Scenario: Account holder disconnects an OAuth provider

- **WHEN** an authenticated account holder disconnects a supported OAuth provider
- **THEN** the system removes the provider data from their account

#### Scenario: Account holder manages a push registration

- **WHEN** an authenticated account holder adds or removes a push registration
- **THEN** the system persists the requested registration state

#### Scenario: Twitter is not offered as a connectable network

- **WHEN** an authenticated account holder views the networks edit page
- **THEN** the system offers Facebook and GitHub as connectable networks
- **AND** does not offer Twitter

#### Scenario: Previously connected Twitter data remains visible

- **WHEN** a member connected Twitter before the feature was removed
- **THEN** the system continues to show their Twitter username on their profile
- **AND** lets them disconnect it from their account settings
