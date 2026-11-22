## ADDED Requirements

### Requirement: Contact request creation allowance

The system SHALL allow twelve contact request creation attempts per authorised member per hourly window by default. Confirming and removing contacts SHALL remain available independently of this allowance.

#### Scenario: Member reaches the contact request creation allowance

- **WHEN** an authorised member submits a contact request after exhausting their hourly allowance
- **THEN** the system returns HTTP 429 with a `Retry-After` header before storing a request or sending a notification
- **AND** another member on the same network can still send a request within their own allowance
