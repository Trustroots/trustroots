# Add optional passkeys for staff account access

## Initial scope

Offer staff an optional WebAuthn second factor after password verification, rather than replacing the account's password or removing TOTP/recovery options. Use the same central definition of privileged roles as account access; include any newly introduced support role during integration.

Registration requires a fresh password and an already verified existing second factor. Never let an enrolment-only session register a replacement method without the established enrolment policy. Members can name, list and remove their own credentials after fresh confirmation. Do not permit deletion of the final usable authentication method without a documented recovery route.

## Server verification

Use a maintained WebAuthn verification library rather than implementing CBOR/COSE or signature parsing locally. Bind a random, short-lived, single-use ceremony challenge to the member, session, ceremony type and authentication version. Verify the configured origin, relying-party ID, challenge, credential ownership, signature and user-verification flag server-side.

Set user verification to required. Attestation is none unless there is a separately approved device-management requirement. Use an opaque stable WebAuthn user handle, not an email. Credential IDs must be unique. Store public key material and necessary counters/backup flags; private keys remain with the authenticator.

Handle synchronised passkeys and zero signature counters according to the verification library's documented semantics. Do not require monotonically increasing counters where the credential cannot provide them.

## Rollout and recovery

Document relying-party and origin configuration for production and isolated previews; never derive trusted origins from request headers. Preserve existing TOTP/recovery methods and sessions. Native clients keep their existing method until they implement the ceremony. Do not make passkeys mandatory in this initial change.

## Validation

Use browser virtual authenticators for registration, sign-in and deletion. Test wrong origin/RP, replay, ownership, missing user verification, expired ceremonies, authentication-version changes and recovery. Validate current WebAuthn guidance against the [W3C specification](https://www.w3.org/TR/webauthn-3/) when selecting the library.

