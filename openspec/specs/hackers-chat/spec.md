# hackers-chat Specification

## Purpose

Give signed-in members a dedicated Nostr room on the Hackers circle.

## Requirements

### Requirement: Member-only Hackers Nostr chat

The Hackers circle SHALL provide chat using kind-1 events tagged
`trustroots-circle-hackers` on the existing Radio relays. Any signed-in
Trustroots member SHALL be able to read chat. Visitors SHALL see a sign-in link
and the application SHALL NOT subscribe to chat or look up author identities
for them. Posting SHALL require a signer matching the member's linked npub and
Trustroots NIP-05 identity, and the signed event SHALL be verified before
publication. The page SHALL detect a complete NIP-07 extension for up to five
seconds, connect a matching identity automatically and offer manual retry. Chat
SHALL show an author's eligible public Trustroots NIP-05 label linked to the
author's profile, with the full npub in the link's native `title` attribute.
When no eligible public Trustroots NIP-05 identity is available, chat SHALL
show the full npub as plain text without a profile link. Chat SHALL show UTC
timestamps and explain that messages are public on Nostr.

#### Scenario: A visitor opens Hackers

- **WHEN** a visitor opens the Hackers circle
- **THEN** the page offers a sign-in link without requesting chat events or
  author identity lookups

#### Scenario: A signed-in member opens Hackers

- **WHEN** a signed-in member opens the Hackers circle
- **THEN** they can read the Hackers room with or without a signer
- **AND** a matching verified signer enables posting to the Hackers topic
- **AND** the Radio room ignores those messages

#### Scenario: A chat author has an eligible public identity

- **WHEN** a signed-in member reads a message from a key linked to an eligible
  public Trustroots NIP-05 identity
- **THEN** the NIP-05 label links to the author's profile with the full npub in
  the native `title` attribute

#### Scenario: A chat author has no eligible public identity

- **WHEN** a signed-in member reads a message from a key without an eligible
  public Trustroots NIP-05 identity
- **THEN** the full npub is shown as plain text without a profile link
