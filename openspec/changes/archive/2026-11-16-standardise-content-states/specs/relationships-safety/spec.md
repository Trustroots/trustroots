## ADDED Requirements

### Requirement: Accessible contact list states

Contact lists SHALL present loading, successful empty and failed request states
with a clear heading and screen-specific explanation. Loading and outcome
states SHALL use existing platform status semantics. A failed request SHALL
provide an accessible action that retries loading contacts.

#### Scenario: Contact loading fails

- **WHEN** a contact list request fails
- **THEN** the screen explains that contacts are unavailable and provides an
  accessible retry action
