## ADDED Requirements

### Requirement: Regular iOS Account uses shared email and newsletter preferences

The regular iOS Account screen SHALL show the email and newsletter controls,
pending email confirmation and save feedback in shared Compose. It SHALL use
the existing iOS account session and authenticated update. Password, sign-out
and Nostr actions SHALL remain available in the Account screen.

#### Scenario: Save account preferences from Compose

- **GIVEN** a signed-in member has opened Account
- **WHEN** they change their email or newsletter preference and save
- **THEN** the app submits those preferences using its existing authenticated update
- **AND** the form shows success or the returned error and any pending email confirmation
