## Why

Local account passwords are stored as PBKDF2-HMAC-SHA1 hashes with 10,000 iterations. Verification and password creation currently use the synchronous crypto API, which blocks the Node.js event loop. The stored hash and salt do not identify their algorithm or work factor, so changing either requires code to infer a legacy representation.

## What Changes

- Store newly set passwords with an asynchronous, memory-hard scrypt verifier whose version, parameters, random salt, and derived key are stored together in the existing password field.
- Keep accepting the existing PBKDF2-HMAC-SHA1 password plus separate salt during a transition, and replace a legacy hash with the current format after successful sign-in.
- Use the new format for registration, password reset, and password change.
- Verify credentials asynchronously and bound in-flight KDF work so login bursts cannot block the event loop or allocate unbounded KDF memory.
- Keep unrecognised or malformed stored verifier formats invalid; preserve the existing generic invalid-credentials response.

The affected areas are the user model and password verification service, local Passport strategy, password reset and change flows, and their server and end-to-end tests. There is no bulk data migration or new password prompt. Existing accounts keep working and migrate on successful sign-in.

## Capabilities

### Modified Capabilities

- `account-access`: define versioned password verifier storage, legacy verification and upgrade, and consistent handling of invalid credentials.

## Impact

The change modifies stored password representation without adding a MongoDB field or dependency. Existing PBKDF2 records remain readable until successful authentication; reset, change, and registration immediately write the current format. A rollback must retain the new verifier reader or restore a compatible application release, because older code cannot verify the new records. Deploy the reader and writer together after the account-security atomic password update lands. Session versioning for actual password changes remains owned by that change; a transparent rehash must not increment `authVersion` or alter `passwordUpdated`.
