## MODIFIED Requirements

### Requirement: Authenticated social interface

Chat and listener identities SHALL be shown only to logged-in Trustroots
members. The interface SHALL NOT subscribe to chat, fetch listener profiles, or
look up author identities for visitors. These restrictions SHALL NOT claim that
public Nostr events are private.

#### Scenario: A member reads the room

- **WHEN** a logged-in member opens the circle without a signer
- **THEN** they can read chat and see listeners but cannot publish

#### Scenario: A visitor opens the room

- **WHEN** a visitor opens Radio
- **THEN** the interface does not request personalised author identity data

### Requirement: Chat message details

Radio chat SHALL show an author's eligible public Trustroots NIP-05 label and
link it to the author's Trustroots profile. The profile link's native `title`
attribute SHALL contain the author's full npub. When no eligible public
Trustroots NIP-05 identity is available, chat SHALL show the full npub as plain
text without a profile link. Each message SHALL display its timestamp in UTC as
yyyy-mm-dd hh:mm. Station hashtags SHALL link to the matching station fragment
on the Radio circle URL.

#### Scenario: A member reads a station message

- **WHEN** a member reads a message tagged with a known station
- **THEN** they see the author's NIP-05 label when eligible, otherwise the full
  npub, and the timestamp in UTC
- **AND** the station hashtag links to the Radio circle with that station selected

#### Scenario: A message author has an eligible public profile

- **WHEN** the author's key is linked to a confirmed, public Trustroots account
  with an eligible NIP-05 identity and without a suspension or shadowban
- **THEN** the NIP-05 label links to that account's Trustroots profile
- **AND** the link's native `title` attribute contains the full npub

#### Scenario: A message author has no eligible public identity

- **WHEN** the author's key has no eligible public Trustroots NIP-05 identity
- **THEN** the full npub is shown as plain text without a profile link

## ADDED Requirements

### Requirement: Radio listening identity labels

The signed-in Radio Listening now list SHALL show an eligible public Trustroots
NIP-05 label for each listener and link it to that member's Trustroots profile.
The profile link's native `title` attribute SHALL contain the listener's full
npub. When no eligible public Trustroots NIP-05 identity is available, the list
SHALL show the full npub as plain text. Visitors SHALL NOT trigger listener
identity lookups.

#### Scenario: A listener has an eligible public profile

- **WHEN** a signed-in member views Listening now and a listener has an eligible
  public Trustroots NIP-05 identity
- **THEN** the listener's NIP-05 label links to their profile with the full npub
  in the native `title` attribute

#### Scenario: A listener has no eligible public identity

- **WHEN** a listener has no eligible public Trustroots NIP-05 identity
- **THEN** their full npub is shown as plain text
