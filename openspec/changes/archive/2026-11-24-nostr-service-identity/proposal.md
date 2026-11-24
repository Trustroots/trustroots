## Why

Trustroots needs a shared Nostr identity for service signing, including Circle chat and future signed member exports. The relay must be able to verify that identity through NIP-05 without a member account.

## What Changes

- Configure the service signer with `TRUSTROOTS_NOSTR_SERVICE_NSEC` and accept the old Circle chat variable during migration.
- Serve the signer's public key as `_@trustroots.org`.
- Let administrators publish a fixed Nostr profile for the service signer.
- Recognise the root identity in the authenticated relay. Retain its public-key verification.

## Impact

Core owns the signer and NIP-05 response, admin publishes the profile, and tribes uses the signer for chat. The Nostroots relay requires a coordinated update. Signed member exports can use the signer in PR #2809.
