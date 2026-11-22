## ADDED Requirements

### Requirement: Signed-in offer search allowance

The system SHALL allow 180 offer searches per member per minute by default in each API process. Browser and mobile searches SHALL share the same member allowance in that process.

#### Scenario: Member reaches the offer search allowance

- **WHEN** a member uses their search allowance across the browser or mobile API
- **THEN** additional searches return HTTP 429 with a `Retry-After` header before querying for offers
- **AND** another member on the same network can still search for offers
