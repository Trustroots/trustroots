## Why

Trustroots members should be able to participate in circle chats with their
existing account, including members who have never set up a Nostr signer.
This addresses the group chat request in #640.

## What Changes

- Use the authenticated Trustroots relay for Hackers, Volunteering, Radio
  and Hitchhikers chat.
- Keep member-managed signing for members with a verified linked key.
- Let members without a linked key post with the Trustroots signing key
  already used for signed Nostr exports.
- Add a Hitchhikers chat and route /volunteers to the volunteering page.

## Capabilities

### New Capabilities

- `mixed-circle-chat`: Room chat backed by the authenticated Trustroots relay
  with both member and Trustroots signing.
