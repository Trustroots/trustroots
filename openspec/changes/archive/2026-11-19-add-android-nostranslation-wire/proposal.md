# Android Nostranslation pairing wire format

## Why

Issue #3633 needs Android to exchange encrypted NIP-46 messages with the
existing Nostranslation client using a separate transport key.

## What Changes

Implement the Android wire adapter for the Nostranslation link, initial
pairing reply, verified incoming RPC and encrypted responses. Use the
existing Bouncy Castle dependency for cryptographic primitives and pin the
relay to Trustroots. Test against browser-produced NIP-44 and NIP-46
fixtures. The relay socket, account pairing UI and storage, and push
delivery remain separate increments.
