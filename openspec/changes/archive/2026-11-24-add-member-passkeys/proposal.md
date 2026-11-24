## Why

Members need to be able to protect their accounts with an authenticator app and add a passkey from their account settings. The existing administrator implementation provides the sign-in and recovery flows for this change.

## What changes

- Let signed-in members opt into authenticator-app two-factor authentication and save recovery codes.
- Let members with an enrolled authenticator add or remove passkeys in account settings. A registered passkey can complete the second step of password sign-in.
- Preserve the administrator sign-in policy and explain the web sign-in requirement before enrolment.

## Impact

- Affected spec: `account-access`.
- Affected code: account settings, MFA and passkey management and sign-in.
- Uses the existing credential storage, deployment configuration and WebAuthn implementation.
