## ADDED Requirements

### Requirement: Review repeated outgoing messages

Administrators and Support volunteers SHALL be able to review outgoing messages with identical stored bodies sent to at least three distinct recipients. Each group SHALL display one copy, total sends, distinct-recipient count, and first and last send times in UTC. The results SHALL be paginated and SHALL omit recipient identities. Access SHALL be audited before evidence is returned. Report forms SHALL disclose this access before submission.

#### Scenario: Staff investigates a verified member report

- **WHEN** staff requests repeated messages from a verified report, including a resolved report
- **THEN** the system checks only the reported member's outgoing messages in the 30 days ending at the original submission time

#### Scenario: Staff investigates a message-throttle alert

- **WHEN** staff requests repeated messages from a message-throttle review
- **THEN** the system checks only the alert sender's outgoing messages within the recorded alert window

#### Scenario: Repeated-message evidence cannot be authorised or audited

- **WHEN** the requester lacks access, the report has no verified member pair, or the audit write fails
- **THEN** the system returns no repeated-message evidence
