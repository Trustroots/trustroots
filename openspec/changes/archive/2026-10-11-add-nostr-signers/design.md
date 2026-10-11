# Design

Import remains a draft suggestion accepted explicitly and saved through the existing form. Verification is a separate action for the saved key; changing the draft requires Save first. Connections are temporary and cleaned up on cancellation, departure and logout.

Use installed nostr-tools NIP-46 primitives with disposable in-memory client keys. Support bunker input and client-generated nostrconnect URIs, QR/copy/open, authentication URLs, relay switching, cancellation and a two-minute connection timeout. Default pairing relay is wss://relay.trustroots.org; allow validated wss relays through CSP. Never substitute a bunker public key for get_public_key's user key.

NIP-55 uses encoded nostrsigner requests and same-origin callbacks. Preserve drafts and random operation correlation in sessionStorage for app handoffs, discard expired or unsolicited results, scrub callbacks once member identity is available, and offer explicit clipboard import. Signing requests return full events. Logout clears pending handoffs. Do not persist signer secrets or send member profile data to signers.

POST /api/users/nostr/challenge reads the saved key and returns an unsigned NIP-98 kind 27235 template with exact verification URL, POST method and random challenge tag. POST /api/users/nostr/verify accepts {event}, verifies hash/signature, exact fields, saved key and 60-second freshness, and atomically consumes the unexpired nonce while writing verified key/timestamp. Challenge state is private on User, bound to the member/key, and rotated on issuance. Existing policy/CSRF and per-member targeted rate limits apply.

OwnProfile gains optional nostrVerifiedAt, emitted only when the recorded verified key equals the saved canonical npub. Public profiles and update allowlists exclude verification and challenge fields. Canonical key changes/removal clear verification and challenge fields. No data migration is needed.
