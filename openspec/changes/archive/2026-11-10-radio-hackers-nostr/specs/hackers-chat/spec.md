## ADDED Requirements

### Requirement: Member-only Hackers Nostr chat

The Hackers circle SHALL provide chat using kind-1 events tagged `trustroots-circle-hackers` on the existing Radio relays. Any signed-in Trustroots member SHALL be able to read chat. Visitors SHALL see a sign-in link and the application SHALL NOT subscribe to chat for them. Posting SHALL require a signer matching the member's linked npub and Trustroots NIP-05 identity, and the signed event SHALL be verified before publication. The page SHALL detect a complete NIP-07 extension for up to five seconds, connect a matching identity automatically and offer manual retry. The chat SHALL display author npubs, links to eligible profiles and UTC timestamps and explain that messages are public on Nostr.

#### Scenario: A visitor opens Hackers

- **WHEN** a visitor opens the Hackers circle
- **THEN** the page offers a sign-in link without requesting chat events

#### Scenario: A signed-in member opens Hackers

- **WHEN** a signed-in member opens the Hackers circle
- **THEN** they can read the Hackers room with or without a signer
- **AND** a matching verified signer enables posting to the Hackers topic
- **AND** the Radio room ignores those messages
