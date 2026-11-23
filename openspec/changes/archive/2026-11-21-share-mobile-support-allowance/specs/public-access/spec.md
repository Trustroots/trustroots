## MODIFIED Requirements

### Requirement: Bounded support requests

Browser and mobile support requests SHALL share request limits by client address
and, when signed in, member identity before persistence and email delivery.
The mobile support endpoint SHALL authenticate the member before applying the
limits. Exceeded policies SHALL return HTTP 429 and Retry-After. Anonymous
browser requests SHALL remain available within the client-address allowance.

#### Scenario: Support allowance is exhausted

- **WHEN** a client or authenticated member exceeds their configured support allowance
- **THEN** the server returns HTTP 429 without storing or emailing that request

#### Scenario: Member submits support requests from both clients

- **WHEN** a member uses their support allowance in a browser and submits another request from the mobile app within the same window
- **THEN** the mobile API returns HTTP 429 and Retry-After without storing or emailing the request
