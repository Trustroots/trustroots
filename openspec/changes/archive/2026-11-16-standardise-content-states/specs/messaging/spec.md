## ADDED Requirements

### Requirement: Accessible message list states

Inbox and conversation content SHALL present loading, successful empty and
failed request states with a clear heading and screen-specific explanation.
Loading and outcome states SHALL use existing platform status semantics. A
failed request SHALL provide an accessible action that retries the failed
request. A successful empty result SHALL NOT be presented as a request failure.

#### Scenario: Inbox loading fails

- **WHEN** the initial inbox request fails
- **THEN** the screen explains that conversations are unavailable and provides
  an accessible retry action

#### Scenario: No conversations exist

- **WHEN** inbox loading succeeds without conversations
- **THEN** the screen presents a successful empty state without an error action
