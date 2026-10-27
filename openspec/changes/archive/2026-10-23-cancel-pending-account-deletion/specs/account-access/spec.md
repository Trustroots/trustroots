## ADDED Requirements

### Requirement: Cancellation of pending account deletion

The system SHALL let an authenticated member inspect and cancel their own pending account deletion request in Account settings. Cancellation SHALL clear removeProfileToken and removeProfileExpires, be safe to repeat, and prevent subsequent confirmation with the cancelled link. Status SHALL reveal only whether a current token has an unexpired lifetime. Neither endpoint SHALL use a caller-supplied account identifier or expose a token. Responses SHALL not be cached.

#### Scenario: Member withdraws a request

- **WHEN** a member cancels a pending deletion request
- **THEN** the stored token and expiry are removed and the account remains usable
- **AND** the old confirmation link is rejected
- **AND** the member may request a new deletion email

#### Scenario: No active request exists

- **WHEN** a token is absent or expired
- **THEN** Account settings does not show an active pending request
- **AND** cancellation succeeds even if no request exists

#### Scenario: Another account or anonymous visitor attempts cancellation

- **WHEN** an anonymous visitor requests status or cancellation
- **THEN** access is denied
- **WHEN** another signed-in member calls cancellation
- **THEN** only their own pending request can be cleared

### Requirement: Discoverable deletion cancellation

Both deletion email variants SHALL include a cancellation link to Account settings. Opening that link SHALL not mutate state. Account settings SHALL show a pending-request notice and explicit cancellation control while a current request exists, including immediately after requesting deletion and after reloading the page. The UI SHALL prevent duplicate submissions and report cancellation failures without hiding the pending request.

#### Scenario: Member follows the email cancellation link

- **WHEN** a member opens the cancellation link and signs in if needed
- **THEN** Account settings offers an explicit cancellation action for their current request
- **AND** merely opening the link does not delete the account or cancel its request

#### Scenario: Cancellation fails

- **WHEN** cancellation cannot be saved
- **THEN** the UI reports the error and allows retrying while retaining pending-request visibility
