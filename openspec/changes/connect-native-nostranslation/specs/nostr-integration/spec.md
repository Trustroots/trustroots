## ADDED Requirements

### Requirement: Foreground native Nostranslation pairing

Trustroots SHALL let a signed-in member with a local Nostr identity approve a scanned or pasted Nostranslation connection request. Each approved client SHALL use a separate transport key and the configured Trustroots relay. Pairings SHALL be stored locally in encrypted, account-scoped storage and SHALL be revocable. Signing SHALL pause at sign-out. Local key removal or replacement SHALL revoke all pairings for that key.

#### Scenario: Member accepts a valid connection

- **WHEN** a member approves a valid Nostranslation connection link
- **THEN** Trustroots pairs on the configured relay and lists the connected client for that account

#### Scenario: Member revokes a connected client

- **WHEN** the member revokes a previously approved client
- **THEN** Trustroots removes its transport key and denies any pending review from that client

### Requirement: Foreground translation review approval

Trustroots SHALL accept signing requests only from an approved client. Each valid kind 27235 review authorisation SHALL display the destination and require its own explicit approval. An approval SHALL be valid once and within the existing 60-second authorisation window.

#### Scenario: Review expires before approval

- **WHEN** the authorisation is older than 60 seconds
- **THEN** Trustroots discards the request and prompts the member to retry from Nostranslation

#### Scenario: Account changes while the review is visible

- **WHEN** the member signs out or switches accounts
- **THEN** Trustroots dismisses pending requests and cannot sign them with either account
