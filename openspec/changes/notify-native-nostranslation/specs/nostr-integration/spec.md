## ADDED Requirements

### Requirement: Native Nostranslation alerts

Trustroots SHALL allow members to opt in to alerts after pairing their device with Nostranslation. Registration SHALL require an authenticated member session and proof of possession of the pairing transport key. The worker SHALL validate signatures, author, recipient and age before sending an alert and SHALL deduplicate event IDs for each registration. Alert content SHALL be generic. Decryption and approval SHALL happen on the device.

#### Scenario: A closed app has an eligible request

- **WHEN** the Trustroots relay presents a fresh signed envelope from an active pairing
- **THEN** the member's opted-in device receives a generic notification through UnifiedPush or APNs

#### Scenario: Duplicate, disabled or revoked alerts

- **WHEN** an envelope has already been processed or the registration is disabled, signed out or revoked
- **THEN** no notification is sent for that registration

#### Scenario: Alert is opened after expiry

- **WHEN** the member opens an expired authorisation
- **THEN** the app prompts them to retry in Nostranslation
