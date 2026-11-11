## MODIFIED Requirements

### Requirement: Chat message details

Radio chat SHALL show an author's eligible public Trustroots NIP-05 label and
link it to the author's Trustroots profile. The profile link's native `title`
attribute SHALL contain the author's full npub. When no eligible public
Trustroots NIP-05 identity is available, chat SHALL show the full npub as plain
text without a profile link. Each message SHALL display its timestamp in UTC as
yyyy-mm-dd hh:mm. Station hashtags SHALL link to the matching station fragment
on the Radio circle URL and start playback when activated in the Radio chat.

#### Scenario: A member reads a station message

- **WHEN** a member reads a message tagged with a known station
- **THEN** they see the author's NIP-05 label when eligible, otherwise the full
  npub, and the timestamp in UTC
- **AND** the station hashtag links to the Radio circle with that station selected

#### Scenario: A member activates a station hashtag

- **WHEN** a member activates a known station hashtag in Radio chat
- **THEN** the player starts or continues playing that station
- **AND** the Radio circle URL has that station's fragment

#### Scenario: A message author has an eligible public profile

- **WHEN** the author's key is linked to a confirmed, public Trustroots account
  with an eligible NIP-05 identity and without a suspension or shadowban
- **THEN** the NIP-05 label links to that account's Trustroots profile
- **AND** the link's native `title` attribute contains the full npub

#### Scenario: A message author has no eligible public identity

- **WHEN** the author's key has no eligible public Trustroots NIP-05 identity
- **THEN** the full npub is shown as plain text without a profile link
