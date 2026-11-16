## ADDED Requirements

### Requirement: Accessible circle discovery states

Circle discovery SHALL present loading, successful empty and failed request
states with a clear heading and screen-specific explanation. Loading and
outcome states SHALL use existing platform status semantics. A failed request
SHALL provide an accessible action that retries the request. A successful
empty result SHALL NOT be presented as a request failure.

#### Scenario: Circle member discovery returns no members

- **WHEN** circle member discovery succeeds with no members
- **THEN** the screen presents its empty explanation as a status and does not
  show an error or retry action
