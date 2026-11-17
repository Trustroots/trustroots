## ADDED Requirements

### Requirement: Member-controlled optional emails

Members SHALL be able to choose the current unread-message email schedule, at most one digest per UTC day, at most one digest per UTC week, or no unread-message emails. Members SHALL be able to turn off hosting reminders independently. Existing accounts SHALL retain current delivery by default.

#### Scenario: Member chooses a digest

- **WHEN** eligible messages from multiple conversations remain unread for a digest recipient
- **THEN** the system sends at most one digest for the selected period grouping eligible conversations
- **AND** inbox delivery and push alerts continue independently

#### Scenario: Member follows an unsubscribe link

- **WHEN** the member confirms a valid unsubscribe link for an optional email category
- **THEN** the system disables that category for the link recipient
- **AND** other email preferences remain unchanged

#### Scenario: Member turns off a category before delivery

- **WHEN** a category is disabled before an optional email is delivered
- **THEN** the system skips that email
