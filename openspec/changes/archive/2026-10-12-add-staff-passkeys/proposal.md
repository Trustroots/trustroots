# Add optional passkeys for staff account access

## Why

Staff should be able to use their device authenticator or a hardware key as an additional account sign-in option.

## What Changes

Add WebAuthn registration, named credential management and password-first passkey verification for staff. Retain the existing authenticator and recovery-code routes during the initial opt-in rollout.

## Impact

Users models, authentication services/routes, account settings, deployment configuration and tests. Depends on the MFA/session policy being settled. Adds a credential collection and indexes; requires explicit relying-party ID and allowed origins. Native passkey support is deferred and existing sign-in methods remain available.

## Delivery

Implement the browser and server flows together with deployment documentation and regression tests. Archive the completed proposal and retain its requirements in the living account-access specification.
