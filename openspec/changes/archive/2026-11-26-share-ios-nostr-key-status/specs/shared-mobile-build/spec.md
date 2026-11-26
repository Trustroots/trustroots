## ADDED Requirements

### Requirement: Regular iOS Account uses shared Nostr public-key status

The regular iOS Account Nostr section SHALL use shared Compose for the Nostr
introduction, profile-key availability and local-key status. It SHALL supply
only availability flags to the shared presentation. The iOS host SHALL keep
selectable key values, account scoping, key operations and their existing
confirmations.

#### Scenario: View the account's Nostr key status

- **GIVEN** a signed-in member has opened Account
- **WHEN** their profile or local key availability changes
- **THEN** the shared status reflects that account's state and the native controls display the applicable key values and actions
