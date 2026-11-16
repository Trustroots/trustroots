## ADDED Requirements

### Requirement: Debug builds can present a shared member journey

Android and iOS debug builds SHALL provide an explicit launch option that opens
the shared Compose member journey and allows returning to the native app.
The host SHALL use its existing secure session and authenticated API client.

#### Scenario: Sign in and reply from a profile

- **GIVEN** a signed-out member opens the shared journey
- **WHEN** they sign in, open an inbox partner's profile and send a reply
- **THEN** the shared screens show the authenticated profile and conversation
- **AND** the successful reply appears once in the conversation
- **AND** the native app can use the same saved session

#### Scenario: Read a conversation from the inbox

- **WHEN** a signed-in member opens a conversation from their inbox
- **THEN** Compose displays the conversation and can return to the inbox

#### Scenario: A reply fails

- **WHEN** the API rejects a reply
- **THEN** the shared conversation displays an error and retains the reply for
  intentional retry
