## ADDED Requirements

### Requirement: Honour SparkPost newsletter unsubscribe events

The authenticated SparkPost webhook SHALL set newsletter consent to false for
members whose current email matches a valid recipient address in a
`list_unsubscribe` or `link_unsubscribe` event in `unsubscribe_event`.
Matching SHALL trim surrounding whitespace and ignore address casing. Other
email preferences SHALL remain unchanged. Unknown recipients, invalid addresses
and unrelated events SHALL NOT change member preferences.

#### Scenario: Member unsubscribes in an email client

- **WHEN** SparkPost delivers an authenticated list unsubscribe event
- **THEN** matching members no longer consent to newsletters
- **AND** their message and notification preferences remain unchanged

#### Scenario: Member follows an unsubscribe link

- **WHEN** SparkPost delivers an authenticated link unsubscribe event
- **THEN** the same newsletter opt-out is persisted

#### Scenario: Batch needs to be retried

- **WHEN** a preference update fails
- **THEN** the webhook returns a retryable server error
- **AND** redelivery of already applied opt-outs is harmless

#### Scenario: Metrics are unavailable

- **WHEN** preference updates succeed but metric recording fails
- **THEN** the webhook acknowledges the batch successfully
