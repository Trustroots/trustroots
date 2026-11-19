# Constrain native Nostranslation signing requests

## Why

The phone signer for #3633 needs the same rules on both platforms.

## What Changes

Add a secret-free policy to the shared Kotlin module from #3232. It prepares a
review only for the authenticated pairing's peer and for the live signing
session. Limit the event to Nostranslation's production review POST, bound to
a payload hash, and use the server's 60-second window. Expose the destination
and retain the original tag order for signing after explicit approval.

This increment supplies the policy and regression tests for the future native
signer. The pairing transport, NIP-44 encryption, UI, persistent revocation,
relay deduplication and push delivery are separate work. The shared module
does not handle keys, make network requests or sign an event.
