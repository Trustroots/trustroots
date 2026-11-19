## ADDED Requirements

### Requirement: Android Nostranslation pairing wire adapter

The Android wire adapter SHALL accept Nostranslation client links for the
Trustroots relay and the translation signing permission. It SHALL acknowledge
a user-approved connection with an encrypted kind `24133` response and a
separate transport key. Before decrypting a request it SHALL verify the event
ID, sender signature, paired peer and transport recipient. The adapter SHALL
expose only the connection, public-key and event signing RPC methods to the
native caller. Event signing still requires the shared approval policy.

#### Scenario: An approved link receives its handshake

- **WHEN** the native caller confirms a valid Nostranslation connection link
- **THEN** the adapter can produce an encrypted reply containing its pairing secret

#### Scenario: An incoming request is altered or addressed elsewhere

- **WHEN** the event signature, author or recipient differs from the approved pairing
- **THEN** the adapter rejects the event before interpreting its content
