## Evaluation

- [x] Compare the official Better Auth plugins and MongoDB adapter against the
      current Trustroots account-access contract.
- [x] Run a local browser probe for password sign-in, passkey-first sign-in,
      TOTP and session revocation. Record the results and package versions.

## Before any member pilot

- [ ] Prove in a focused server test that passkey sign-in without its required
      second factor leaves no usable Trustroots session.
- [ ] Test legacy password mapping, password recovery, suspension, concurrent
      sessions and rollback on isolated MongoDB 4.4 and 7.0 databases.
- [ ] Add a browser journey for an existing account using a passkey as the
      first sign-in method, including device loss and required TOTP.
- [ ] Verify the Android and iOS bearer lifecycle before changing its contract.
- [ ] Review the result in #3660 and decide whether to implement the pilot.
