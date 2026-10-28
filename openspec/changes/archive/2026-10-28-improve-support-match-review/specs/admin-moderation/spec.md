## ADDED Requirements

### Requirement: Efficient historical match review

Administrators SHALL be able to select all unambiguous suggestions, clear selection and preview a matching window from one to sixty minutes. Window changes SHALL clear the preview and selections. The server SHALL validate, persist and recheck the chosen window. Bulk selection SHALL exclude competing or shared targets and exact matches. Review SHALL show original local requester details only to administrators, without adding personal data to reduced files or audit logs.

#### Scenario: Wider matching window

- **WHEN** an administrator changes the matching window
- **THEN** a fresh preview is required and apply checks the window stored with that preview
- **AND** original sender/category and message equivalence remain required

#### Scenario: Bulk review

- **WHEN** staff choose Select all unambiguous matches
- **THEN** only unique suggestions without competing source or target assignments are selected
- **AND** original local sender details are visible to help review the decisions
