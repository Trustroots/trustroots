## ADDED Requirements

### Requirement: Chat message details

Radio chat SHALL show each author's Nostr public key in npub format and link
it to their Trustroots profile when the key belongs to an eligible public
account. Each message SHALL display its timestamp in UTC as yyyy-mm-dd hh:mm.
Station hashtags SHALL link to the matching station fragment on the Radio
circle URL.

#### Scenario: A member reads a station message

- **WHEN** a member reads a message tagged with a known station
- **THEN** they see the author's npub and the timestamp in UTC
- **AND** the station hashtag links to the Radio circle with that station selected

#### Scenario: A message author has an eligible public profile

- **WHEN** the author's key is linked to a confirmed, public Trustroots account
  without a suspension or shadowban
- **THEN** the npub links to that account's Trustroots profile
- **AND** authors without an eligible account are shown as plain npubs
