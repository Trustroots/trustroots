# Connect native Nostranslation signing

## Why

Members need to approve translation review signatures from their Trustroots phone app using the Nostr identity already stored for their account.

## What Changes

- Pair with Nostranslation through a scanned or pasted connection request.
- Store the transport key under the current server and account and show connected clients with revocation controls.
- Subscribe to the Trustroots relay while signed in and present a separate decision for each eligible review.
- Limit authorisations to the configured review destination and its 60-second window.

## Impact

- Specs: nostr-integration
- Code: Android and iOS account screens, key stores and relay connections
- Tracking: #3633
