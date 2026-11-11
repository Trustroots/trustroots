# Show Trustroots NIP-05 identities in Nostr chat

## Why

Eligible public Trustroots members should be recognisable in Radio and Hackers
chat and in Radio's shared Listening now list. Showing a verified Trustroots
NIP-05 label while retaining the full npub as link metadata or fallback keeps
the Nostr identity discoverable and preserves a clear identity for authors
without an eligible public Trustroots profile.

## What Changes

- Show the eligible public Trustroots NIP-05 label for linked authors in Radio
  and Hackers chat and Radio's Listening now list.
- Link eligible labels to the member's Trustroots profile and expose the full
  npub in the link's native `title` attribute.
- Show the full npub as plain text when no eligible public Trustroots NIP-05
  identity is available.
- Do not look up author identities for visitors; personalised identity lookups
  remain limited to signed-in members.

## Impact

- Affected modules: `modules/tribes` and its existing Nostr author visibility
  integration.
- No data migration or deployment sequencing is required. Existing Nostr event
  formats and profile visibility rules remain unchanged.
