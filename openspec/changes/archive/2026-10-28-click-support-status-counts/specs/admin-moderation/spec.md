## ADDED Requirements

### Requirement: Support status count filtering

Support staff SHALL be able to activate any status count, including unconfirmed legacy status, to filter requests. Controls SHALL expose their selected state and support keyboard interaction. Filtering SHALL update the URL, preserve search and category, and reset pagination.

#### Scenario: Filter from a status count

- **WHEN** staff activate a status count
- **THEN** the inbox shows requests for that status on page one while retaining search and category
- **AND** the selected count and status dropdown reflect the URL filter
