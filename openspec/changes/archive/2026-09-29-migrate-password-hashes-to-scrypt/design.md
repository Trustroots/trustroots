## Context

`UserSchema` currently stores `password` as the base64 PBKDF2 result and `salt` as a separate base64 value. The pre-save hook calls `pbkdf2Sync(password, salt, 10000, 64, 'SHA1')`; `authenticate()` repeats that derivation synchronously. The local Passport strategy and password-change controller call `authenticate()` directly. Registration and reset set a plain password before saving. The account-security change is independently adding atomic password changes and an `authVersion`; this proposal depends on that work and will need to integrate its controller changes after it lands.

Node's async `crypto.scrypt()` is available throughout the supported Node 24 range and avoids a native package. Node's built-in Argon2 API was added in Node 24.7, while the project currently permits Node 24.0 and the production Passenger image only checks the major version. Use scrypt for consistent operation across the declared runtime range. OWASP recommends scrypt when Argon2id is unavailable and lists equivalent minimum configurations; the chosen baseline is `N=2^17`, `r=8`, `p=1` (128 MiB per active derivation).

## Decisions

1. **Use a self-describing scrypt verifier.** Store a tagged format in `password`, for example `$scrypt$v=1$ln=17,r=8,p=1$<salt-base64url>$<key-base64url>`. Generate a unique 16-byte salt and a 32-byte derived key. Keep parameters fixed to an allowlisted current configuration; parse and validate format, version, parameter bounds, salt length, and key length before starting KDF work. Do not accept arbitrary stored cost parameters, unknown versions, or malformed encodings.
2. **Retain a narrow legacy reader.** A record with a base64 `password` and separate base64 `salt` is verified with the exact existing PBKDF2-HMAC-SHA1 10,000-iteration, 64-byte configuration, using the asynchronous API. Compare derived bytes with `timingSafeEqual` after validating equal lengths. Do not change password text encoding, normalise, trim, or truncate existing inputs.
3. **Upgrade only after proof of the password.** After a successful legacy verification, derive the new verifier and update with compare-and-swap criteria containing the observed `_id`, old password, and old salt. Unset the legacy salt. If the record changed concurrently, do not overwrite it or create a session from the stale verification; return the same generic credential failure so the user can retry. A rehash does not change `passwordUpdated` or increment `authVersion`.
4. **Make all write paths use one async helper.** `User.hashPassword(password)` returns a Promise for the new verifier. The password pre-save hook awaits it for registration and any path still using `save()`. Reset and change flows that write atomically after the account-security work must await it before their atomic update, unset `salt`, and retain that change's `$inc: { authVersion: 1 }` behavior. `user.authenticate(password)` becomes asynchronous; callers await it or use an async Passport verification callback.
5. **Keep credential failure behaviour uniform.** Unknown users, invalid passwords, malformed hashes, and unsupported formats return the same generic invalid-credentials result. Run a current-cost dummy verification for unknown users and for failed legacy verification, so the faster legacy KDF does not make valid legacy accounts distinguishable by timing. KDF infrastructure errors fail authentication without logging supplied passwords, salts, or derived keys.
6. **Bound resource use.** All derivations use asynchronous Node crypto APIs. A process-local FIFO scheduler allows one active derivation and at most 64 waiting requests; once full, it returns a retryable service-unavailable response rather than starting unbounded work or reporting wrong credentials. The active and queued counts are observable without credential data. On the measured host, one scrypt derivation took about 231 ms, so a full queue can add roughly 15 seconds before its last request begins; the active KDF still uses about 128 MiB regardless of queue depth. Validate that tail latency and the memory held by waiting requests fit the deployment's process and request budgets. Do not increase `UV_THREADPOOL_SIZE` as a substitute for limiting KDF work.

## Risks / Trade-offs

- The 128 MiB target is materially more expensive than the legacy KDF. Benchmarking on the local Node 24.21 host showed a single async scrypt derivation at approximately 231 ms; this does not predict production latency or concurrent memory pressure.
- A process-local limit is multiplied by every web and worker process. Confirm process counts, memory limits, and the current Passenger runtime before setting the production limit.
- Opportunistic migration leaves inactive accounts on the legacy verifier until their next sign-in. No plaintext password is available for offline conversion.
- Unknown-user timing equalisation performs the full current KDF even when no account exists, increasing the work performed by unauthenticated requests; the bounded scheduler is required.
- Code that reads or writes the old separate `salt` field must be updated or remain explicitly legacy-only. Password hashes and salt must continue to be excluded from profiles, logs, and email payloads.

## Rollout

1. Land the account-security atomic update first, or integrate its final changes before editing reset/change flows.
2. Deploy the application that can verify both legacy and new formats before it writes new-format hashes. Do not roll back to an older release once new-format credentials have been written.
3. Observe KDF latency, queue depth, and memory on the production runtime without logging account identifiers or credential material. Tune only within the documented safe parameter floor and operational memory budget.

## References

- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) recommends Argon2id where available and scrypt as the fallback, and describes the cost-versus-performance trade-off and opportunistic legacy upgrades.
- [NIST SP 800-63B-4, Section 3.1.1.2](https://pages.nist.gov/800-63-4/sp800-63b.html) requires salted password hashing and recommends recording the scheme and cost parameters with the verifier.
- [Node.js v24.21.0 crypto documentation](https://nodejs.org/download/release/v24.21.0/docs/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback) documents asynchronous `crypto.scrypt`, its configurable cost parameters, and salt guidance.
