## ADDED Requirements

### Requirement: Shared iOS Nostranslation pending review presentation

The regular iOS Nostranslation signing sheet SHALL present its pending translation review's destination, expiry feedback and decision controls with shared Compose. The iOS host SHALL bind the controls to the displayed native review and use the existing signer to resolve it.

#### Scenario: Approving a displayed review

- **WHEN** a pending review appears in the iOS signing sheet
- **THEN** Compose displays the destination and explicit approval and denial controls
- **AND** selecting approval passes the displayed review to the existing native signer for authorisation

#### Scenario: Viewing an expired review

- **WHEN** the iOS timeline marks the displayed review expired
- **THEN** Compose shows the expiry warning, disables approval and offers dismissal
- **AND** the native signer continues to check the current time when resolving an approval

#### Scenario: Acting on a replaced review

- **WHEN** the displayed review has been removed or replaced before the native decision is handled
- **THEN** the stale action leaves the current review available for its own explicit decision
