# hackers-chat Specification

## Purpose

Give signed-in members a dedicated Nostr room on the Hackers circle.

## Requirements

### Requirement: Member-only Hackers Nostr chat

The Hackers circle SHALL provide chat using kind-1 events tagged
`trustroots-circle-hackers` on the authenticated Trustroots relay. Eligible signed-in
Trustroots members SHALL be able to read and post. Visitors SHALL see a sign-in link
and the application SHALL NOT subscribe to chat or look up author identities
for them. Members with a linked npub SHALL use a matching Trustroots NIP-05
identity for signing. Trustroots SHALL sign for members without a linked npub
as specified by mixed circle chat. The page SHALL detect a complete NIP-07 extension for up to five
seconds, connect a matching identity automatically and offer manual retry. Chat
SHALL show an author's eligible public Trustroots NIP-05 label linked to the
author's profile, with the full npub in the link's native `title` attribute.
When no eligible public Trustroots NIP-05 identity is available, chat SHALL
show the full npub as plain text without a profile link. Chat SHALL show UTC
timestamps and explain who can access the relay messages.

#### Scenario: A visitor opens Hackers

- **WHEN** a visitor opens the Hackers circle
- **THEN** the page offers a sign-in link without requesting chat events or
  author identity lookups

#### Scenario: A signed-in member opens Hackers

- **WHEN** a signed-in member opens the Hackers circle
- **THEN** they can read the Hackers room with or without a signer
- **AND** members can post with a matching signer or via Trustroots
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
