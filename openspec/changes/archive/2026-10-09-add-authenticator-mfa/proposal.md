# Authenticator MFA

## Why

Reduce account takeover, data disclosure and abuse risk at existing Trustroots boundaries.

## What Changes

Add TOTP enrolment, verification, single-use recovery codes and password-confirmed management. Encrypt TOTP secrets with a dedicated deployment key. Require administrators and moderators to enrol and verify MFA before privileged access. Password recovery must not bypass MFA.

## Impact

Affected modules: users, core, configuration and tests. Preserve client and server coverage thresholds and existing end-to-end tests. Document deployment and compatibility implications alongside implementation.
