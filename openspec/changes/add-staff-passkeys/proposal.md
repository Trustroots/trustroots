# Add optional passkeys for staff account access

## Why

Staff should be able to use their device authenticator or a hardware key as an additional account sign-in option.

## What Changes

Add WebAuthn registration, named credential management and password-first passkey verification for staff. Retain the existing authenticator and recovery-code routes during the initial opt-in rollout.

## Impact

Users models, authentication services/routes, account settings, deployment configuration and tests. Depends on the MFA/session policy being settled. Adds a credential collection and indexes; requires explicit relying-party ID and allowed origins. Native passkey support is deferred and existing sign-in methods remain available.

## Delivery

This is a proposal-only change. Runtime implementation, migrations and deployment are separate follow-up work after the design is reviewed. The proposal remains unarchived until implementation is complete.

