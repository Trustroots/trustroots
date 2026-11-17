# Design

The editor signs the existing ownership challenge before adding or replacing a profile key. Connections are temporary and cleaned up on cancellation, departure and logout.

Use installed nostr-tools NIP-46 primitives with disposable in-memory client keys. Support bunker input and client-generated nostrconnect URIs, QR/copy/open, authentication URLs, relay switching, cancellation and a two-minute connection timeout. Default pairing relay is wss://relay.trustroots.org; allow validated wss relays through CSP. Never substitute a bunker public key for get_public_key's user key.

NIP-55 uses encoded nostrsigner requests and same-origin callbacks. Preserve drafts and random operation correlation in sessionStorage for app handoffs, discard expired or unsolicited results, scrub callbacks once member identity is available, and offer explicit clipboard import. Signing requests return full events. Logout clears pending handoffs. Do not persist signer secrets or send member profile data to signers.

The editor requests a challenge for the proposed npub from `POST /api/users/nostr/challenge` and passes it to the selected signer. It sends the signed event as `nostrProof` with the profile update. The existing endpoint validates and consumes the challenge before saving the key.
