# Hash account action tokens

## Why

Reduce account takeover, data disclosure and abuse risk at existing Trustroots boundaries.

## What Changes

Store digests of password-reset, email-confirmation and account-removal tokens. Accept outstanding legacy tokens for their existing lifetime. Preserve atomic reset consumption and existing URLs. Include a dry-run-first, idempotent migration for outstanding raw tokens, run after every application and worker instance supports digest lookups. Conditional writes prevent resurrection of consumed or reissued tokens.

## Impact

Affected modules: users, core, configuration and tests. Preserve client and server coverage thresholds and existing end-to-end tests. Document deployment and compatibility implications alongside implementation.
