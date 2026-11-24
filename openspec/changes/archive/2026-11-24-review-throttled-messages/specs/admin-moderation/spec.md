## ADDED Requirements

### Requirement: Review outgoing messages for a recipient-limit alert

The system SHALL give Support team members and administrators read-only,
paginated access to the alert sender's outgoing messages within the saved
recipient-limit window. It SHALL derive the sender and bounds from the alert
review identifier and record the staff member, review identifier and page before
returning message content.

#### Scenario: Staff opens an alert review

- **WHEN** an authorised staff member opens the alert's review link
- **THEN** the page shows the recorded window in UTC and outgoing messages within it
- **AND** messages outside the window and incoming replies are excluded

#### Scenario: The review cannot be authorised or audited

- **WHEN** the viewer lacks an allowed role or the audit cannot be saved
- **THEN** no private message content is returned
