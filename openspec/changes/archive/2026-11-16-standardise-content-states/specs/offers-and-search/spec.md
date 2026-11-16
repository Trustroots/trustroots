## ADDED Requirements

### Requirement: Accessible member search states

Member search SHALL present loading, successful empty and failed request states
with a clear heading and screen-specific explanation. Loading and outcome
states SHALL be announced with the platform's existing status semantics. A
failed request SHALL provide an accessible action that retries the request. A
successful empty result SHALL NOT be presented as a request failure.

#### Scenario: Member search fails

- **WHEN** a member search request fails
- **THEN** the screen explains that search is unavailable and provides a
  keyboard and screen-reader accessible retry action
