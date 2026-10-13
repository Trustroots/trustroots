## ADDED Requirements

### Requirement: Contact requests respect member blocks

The server SHALL reject contact creation when either participant has blocked
the other, before creating a relationship or sending its email.

#### Scenario: Either member has blocked the other

- **WHEN** a member submits a contact request for a blocked pair
- **THEN** the server rejects the request without creating a contact or email job
