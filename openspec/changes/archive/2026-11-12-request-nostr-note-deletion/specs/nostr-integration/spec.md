## ADDED Requirements

### Requirement: Request deletion of a featured Nostr note

Trustroots SHALL let an administrator request deletion of a featured note by signing a NIP-09 kind 5 event with the note's original author key. The deletion request SHALL include the note's event ID and kind. After at least one relay acknowledges publication, Trustroots SHALL verify the signed deletion request against the original author, remove the note content from its featured collection and prevent it from being featured again. The confirmation SHALL explain that relays and clients may retain copies.

#### Scenario: The note author requests deletion

- **WHEN** an administrator confirms the request, the matching signer signs it and a relay acknowledges publication
- **THEN** Trustroots removes the note from the homepage and prevents it from being featured again

#### Scenario: Deletion is not acknowledged

- **WHEN** the signer is unavailable, its key differs from the note author's key, or no relay acknowledges publication
- **THEN** the admin page reports the failure and the homepage keeps showing the note

#### Scenario: A deletion record is retried

- **WHEN** the relay accepted the deletion request and recording it on Trustroots temporarily fails
- **THEN** the administrator can retry saving the signed deletion without publishing a new request

#### Scenario: The administrator removes a note locally

- **WHEN** an administrator uses the homepage removal action
- **THEN** Trustroots removes the homepage copy and allows the note to be featured again
