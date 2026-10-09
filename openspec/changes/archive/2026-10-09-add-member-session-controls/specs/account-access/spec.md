## ADDED Requirements

### Requirement: Member session controls

The system SHALL allow members to list their own active sessions using opaque
identifiers and identify the current session. Session controls SHALL expose no
browser fingerprint or precise location. Individual revocation and account-wide
sign-out SHALL require the member's current password. The system SHALL enforce a
seven-day idle and 28-day absolute lifetime for regular members, and a 30-minute
idle and 12-hour absolute lifetime for administrators, moderators, and
welcome-team members. Revoked records SHALL remain as tombstones until absolute
expiry so concurrent requests cannot recreate revoked sessions. Session-control
responses SHALL not be cached, and mutations SHALL use a dedicated shared
request limit. Deployments SHALL create the MemberSession TTL index because
production disables automatic index creation.

#### Scenario: Security boundary is exercised

- **WHEN** the corresponding account or privacy operation is exercised
- **THEN** the system enforces the stated security behaviour without disclosing sensitive credentials
