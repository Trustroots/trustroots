## ADDED Requirements

### Requirement: Hashed account action credentials

The system SHALL store SHA-256 digests of newly issued email-confirmation, password-reset and account-removal tokens. Email links SHALL contain the original random bearer token and existing URL formats SHALL remain compatible. Stored digests SHALL not be accepted as bearer tokens.

#### Scenario: Member follows a new action link

- **WHEN** an action token is issued
- **THEN** its digest is stored in the user document and its original value is sent in the email link
- **AND** a valid original token can complete its action while the stored digest cannot

#### Scenario: Password reset is repeated

- **WHEN** a password reset consumes a valid token
- **THEN** the token is atomically removed and a subsequent attempt is rejected

#### Scenario: Outstanding legacy link is used

- **WHEN** a member follows an outstanding legacy token link
- **THEN** the link remains valid under its existing expiry and action requirements

#### Scenario: Signup reminder races with confirmation

- **WHEN** a reminder prepares a fresh confirmation token while another request consumes or replaces the existing token
- **THEN** the reminder does not restore or overwrite that token and sends no stale reminder

#### Scenario: Operator migrates outstanding legacy credentials

- **WHEN** the maintenance migration is run without an apply flag
- **THEN** it reports aggregate counts without modifying credentials or disclosing bearer values
- **WHEN** the migration is explicitly applied
- **THEN** legacy tokens are replaced by digests without changing expiry or restoring concurrently consumed tokens
- **AND** repeated application is idempotent
