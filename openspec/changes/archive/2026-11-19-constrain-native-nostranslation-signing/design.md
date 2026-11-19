## Native adapter boundary

Construct a pairing only after the member approves the client. Store the
account, client public key and signing public key with the pairing. Verify the
NIP-46 envelope signature and recipient and decrypt it with the separate
transport key before invoking the policy. Route only `sign_event` here. The
connection and public-key methods have separate protocol handling.

Render the returned destination and expiry. Invoke approval only after member
confirmation and sign the returned event using its named account key, within
the same signing-session revision. Recheck the session before sending a
response if native signing suspends. The policy token is consumed on the first
decision. The relay adapter owns envelope and request deduplication so receipt
of the same packet cannot prompt again.

Sign-out pauses the session and invalidates pending approvals. A pairing may
be restored when the same account and key return. Revocation is durable and
belongs to the pairing store. Revoke before key deletion or replacement, even
if the member later reimports the same private key.
