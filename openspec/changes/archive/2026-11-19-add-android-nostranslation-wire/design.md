## Adapter boundary

The UI must show the destination and obtain approval before constructing the
wire adapter. The connection link's name and URL are client-supplied labels.
A verified transport event authenticates the paired key. The relay caller
must use only the configured Trustroots relay and retain the already signed
handshake event if publishing it needs a retry.

Provide a separate per-pair transport key from native storage. Serialize
operations for each adapter and close it on sign-out or revocation. The
adapter clears the copied transport key and conversation key on close and
drops the pairing secret after generating the handshake. The storage layer
owns the original key and durable revocation.

The decoder verifies the signed envelope before decrypting. It returns the
event ID with the RPC so the relay caller can deduplicate deliveries.
Pass translation signing requests to the shared approval policy and use
the account identity only after approval. The wire adapter never has access
to that identity's private key.

NIP-44 messages are limited to 16 KiB of UTF-8 plaintext for this workflow.
Nostranslation signs an authorisation event with a payload digest, so its
translation body does not have to pass through this channel.
