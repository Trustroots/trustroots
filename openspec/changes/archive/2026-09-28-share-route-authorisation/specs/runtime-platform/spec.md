## ADDED Requirements

### Requirement: Shared route authorisation middleware

The users, offers, messages, contacts, tribes and reference-thread callback-based route policies SHALL share role lookup and ACL response handling while preserving route grants, guest fallback, domain prechecks, ownership shortcuts and existing HTTP status and response bodies. The admin policy and asynchronous experiences policy remain outside this shared middleware.

#### Scenario: ACL allows a request

- **WHEN** one of the six policies evaluates a request after its domain prechecks
- **THEN** it checks the existing route grant for the user's roles, or `guest` when roles are absent, and calls the next handler only when allowed

#### Scenario: ACL denies or fails

- **WHEN** the ACL denies a request or reports an unexpected error
- **THEN** the policy returns its existing 403 denial or 500 error response, including its established JSON or send method

#### Scenario: Excluded policies

- **WHEN** the admin or asynchronous experiences policy evaluates a request
- **THEN** its existing authorisation and error handling remains in use
