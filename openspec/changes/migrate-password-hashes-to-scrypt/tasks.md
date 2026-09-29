## 1. Versioned asynchronous password verifier

- [ ] 1.1 Add a server password-hashing service that writes the versioned scrypt format, strictly parses supported formats, verifies current hashes, and asynchronously verifies the exact legacy PBKDF2 format.
- [ ] 1.2 Add constant-time derived-key comparison, current-cost dummy verification for unknown users and failed legacy credentials, and a bounded process-local KDF scheduler with safe overload handling.
- [ ] 1.3 Update the user save hook and asynchronous model APIs; ensure registration writes only the new format and clears any separate legacy salt.
- [ ] 1.4 Update local Passport authentication and password-change verification for asynchronous results; preserve the generic invalid-credentials response and keep KDF errors free of credential values in logs.
- [ ] 1.5 Integrate reset and password-change writes with the account-security atomic update and `authVersion`; hash before the atomic write, clear legacy salt, and preserve session-revocation semantics.
- [ ] 1.6 Upgrade a valid legacy password with compare-and-swap during sign-in; test that a concurrent password update is never overwritten and a stale verification does not create a session.

## 2. Coverage and rollout

- [ ] 2.1 Add anonymous unit and server integration coverage for registration, current-format success and failure, legacy success and failure, reset, change, malformed and unknown formats, mixed stored records, queue saturation, KDF errors, and concurrent update behaviour.
- [ ] 2.2 Add or extend an end-to-end account flow that signs up and signs in using the new verifier without reducing the existing end-to-end test count.
- [ ] 2.3 Keep server and client coverage at 100%; run relevant server tests and the selected end-to-end test.
- [ ] 2.4 Update `openspec/specs/account-access/spec.md`, validate the proposal and final change, then archive it after implementation and verification.
