## ADDED Requirements

### Requirement: Email confirmation preview

The system SHALL show the current and pending email addresses before confirming an email change in a responsive, labelled confirmation card. Signup confirmations SHALL show the pending address and explain profile activation. Previewing SHALL validate the confirmation credential and expiry without changing the account or consuming the credential. Preview responses SHALL disable caching and expose only the two email addresses and signup status to holders of a valid link. Invalid or expired links SHALL show recovery guidance without displaying address details or enabling confirmation.

Account settings SHALL offer resending only for an unverified signup or a pending address different from the confirmed email. Already confirmed addresses SHALL not show a resend button, and resend requests for them SHALL be rejected. An unverified signup SHALL still be able to request a fresh link after expiry.

#### Scenario: Member previews an email change

- **WHEN** a member opens a valid email change confirmation link, including while signed out
- **THEN** the page shows the current and new email addresses with clear labels
- **AND** explains that confirming replaces the address used for signing in and notifications
- **AND** the account remains unchanged until confirmation is submitted

#### Scenario: New member confirms signup

- **WHEN** a new member opens a valid signup confirmation link
- **THEN** the page shows the pending address and explains that confirmation makes their profile visible

#### Scenario: Invalid preview

- **WHEN** a confirmation link is invalid or expired
- **THEN** no email addresses are returned and the page provides a recovery path

### Requirement: Cancel pending email changes

Members SHALL be able to cancel an existing account's pending email change from account settings or a valid confirmation link. Cancellation SHALL atomically clear the matching pending email, token and expiry metadata while preserving the current email. Cancelled links SHALL no longer confirm an address. Signup activation SHALL not offer cancellation. Cancellation SHALL require either the valid unexpired token or an authenticated account matching the pending address, and SHALL reject stale requests without cancelling a newer change. Token cancellation SHALL not sign the visitor in.

#### Scenario: Cancel from account settings

- **WHEN** a signed-in member cancels the displayed pending email change
- **THEN** the pending change disappears, their current email stays active and its confirmation link becomes invalid

#### Scenario: Cancel from a confirmation link

- **WHEN** a visitor cancels a pending change using its valid confirmation link
- **THEN** the page confirms cancellation and shows the address that remains active
- **AND** the visitor is not signed in by cancelling

#### Scenario: Cancellation races with another change

- **WHEN** an old link or account settings request tries to cancel a superseded or confirmed change
- **THEN** the request fails without changing the current or newer pending address
