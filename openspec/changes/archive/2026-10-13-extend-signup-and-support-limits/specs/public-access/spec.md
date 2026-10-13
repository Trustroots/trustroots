## ADDED Requirements

### Requirement: Bounded support requests

Support SHALL apply shared request limits by client address and, when signed in,
member identity before persistence and email delivery. Exceeded policies SHALL
return HTTP 429 and Retry-After. Anonymous requests SHALL remain available within
the client-address allowance.

#### Scenario: Support allowance is exhausted

- **WHEN** a client or authenticated member exceeds their configured support allowance
- **THEN** the server returns HTTP 429 without storing or emailing that request
