# Account action token storage

New password recovery, email confirmation and account removal tokens are stored as SHA-256 digests with a sha256: prefix. Raw tokens exist transiently in document locals while rendering the email. Mail jobs necessarily contain the rendered link: restrict their database access and retention as sensitive outbox data.

URLs and expiry rules remain compatible. Validation hashes the submitted raw token, while accepting outstanding legacy raw records until they expire or are replaced/consumed. Stored digests are explicitly rejected as submitted bearer tokens. No secret rotation is required. Existing indefinite email-confirmation lifetimes are unchanged, so deployers must convert outstanding raw tokens after all application and worker instances run the new code.

Signup reminders issue and persist a fresh confirmation token before rendering their email, because a stored digest cannot reconstruct an old link. Like an explicit resend, this replaces the previous link. A compare-and-set requires the member to remain unconfirmed with the same previous token; a concurrent confirmation or resend causes the reminder to be skipped. Failed persistence prevents the reminder from being sent.

Password reset still updates the verifier, consumes the reset token and advances authVersion atomically. Regression tests follow the token in the rendered email, assert digest-only account storage, reject bearer digests and verify single-use reset behaviour. All test identities are fictional.

## Convert existing records

After rolling out the new application and workers, run the maintenance script against the configured database. It defaults to a read-only dry run:

`node bin/db-maintenance/hash-account-action-tokens.mjs`

Review the aggregate candidate count, then convert with:

`node bin/db-maintenance/hash-account-action-tokens.mjs --apply`

The script never prints tokens, member identifiers or database credentials. It hashes each field with a conditional update so consumed or concurrently replaced tokens are not restored. It preserves expiry dates and existing email links, skips already hashed tokens, and can be rerun safely. Do not roll back to code that only understands plaintext token lookup after conversion. A normal protected backup remains subject to existing access and retention policies.
