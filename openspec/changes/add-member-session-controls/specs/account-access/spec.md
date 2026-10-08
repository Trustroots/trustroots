## ADDED Requirements

### Requirement: Member session controls

The system SHALL implement the following security behaviour: Add an own-session list, individual revocation and sign-out-everywhere. Enforce server-side idle and absolute timeouts, shorter for privileged accounts. Require password confirmation for session management mutations. Do not collect browser fingerprints or exact location.

#### Scenario: Security boundary is exercised

- **WHEN** the corresponding account or privacy operation is exercised
- **THEN** the system enforces the stated security behaviour without disclosing sensitive credentials
