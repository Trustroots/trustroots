## Sign-in policy to evaluate

A passkey enrolled by an existing member should be offered as the first
sign-in option, ahead of the password form. It must return the same Trustroots
member ID. Require WebAuthn user verification and keep password sign-in and
recovery available for accounts that have them. Begin with enrolment from an
authenticated account. New-account passkey enrolment would need its own review
of account confirmation and registration rules.

For members whose policy permits a verified passkey alone, completion of the
passkey ceremony can establish the session. For roles or accounts that require
a separate factor, the passkey is the first factor. The session must remain
pending until TOTP or an authorised one-use recovery code succeeds. Staff
permissions must continue to come from Trustroots' account and role records.

Better Auth provides an official passkey plugin for passwordless sign-in and a
2FA plugin with delivered OTP, TOTP and backup codes. Its standard 2FA
sign-in handling covers credential sign-in. A passkey-first flow subject to
mandatory 2FA needs explicit server-side integration. A client-side prompt
alone cannot enforce that policy. Nostr can be evaluated separately as another
first factor under the same session requirement.
[Passkey plugin](https://better-auth.com/docs/plugins/passkey) ·
[2FA plugin](https://better-auth.com/docs/plugins/2fa)

## Fit with Trustroots

| Area                          | Better Auth capability                                                                      | Trustroots work before a pilot                                                                                                                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Password sign-in and recovery | Password sign-in, custom hash and verification functions, and a configurable reset flow.    | Preserve username and email login, legacy PBKDF2 and versioned scrypt verification, bounded password verification, private reset acknowledgements and existing confirmation rules. Prove migration with test fixtures for both hash formats. |
| Passkeys                      | WebAuthn registration and primary sign-in.                                                  | Require user verification, configure relying party IDs and origins for each supported deployment, bind credentials to a single existing member ID, and prove enrolment and recovery with a second device.                                    |
| Two-factor authentication     | TOTP, delivered OTP and backup codes.                                                       | Use TOTP first. Verify that sign-in, recovery and enrolment all obey the same policy before any protected session or staff access is available. Decide how staff would enrol or re-enrol.                                                    |
| Browser sessions              | Database-backed sessions, sign-out and bulk revocation.                                     | Preserve cookie protections, expiry and immediate revocation after password changes, suspension and other account changes. Verify the revocation behaviour with concurrent sessions and document rollback.                                   |
| Android and iOS access        | A bearer token plugin is available.                                                         | Preserve the existing mobile API contract, including token expiry, refresh and revocation. Test both clients before changing their auth endpoints.                                                                                           |
| MongoDB                       | The adapter supports standalone servers and transactions where supported by the deployment. | Validate the required indexes, readiness and write consistency on MongoDB 4.4 and 7.0. Measure the migration on test data and rehearse rollback.                                                                                             |

[Password and reset options](https://better-auth.com/docs/reference/options#emailandpassword) ·
[Session management](https://better-auth.com/docs/concepts/session-management) ·
[Bearer plugin](https://better-auth.com/docs/plugins/bearer) ·
[MongoDB adapter](https://better-auth.com/docs/adapters/mongo)

## Browser probe results

The [probe](probe.mjs) ran with Better Auth and its passkey plugin at
1.7.25, using a Playwright 1.65.0 Chromium virtual authenticator and the
in-memory adapter.

| Flow                                                          | Observed result                                                                                                                   |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Sign in with the test member's password before TOTP enrolment | The browser got a session for the existing account.                                                                               |
| Sign in with the enrolled passkey and user verification       | The session resolved to the same account. The default passkey flow opened a session even though TOTP was enabled on that account. |
| Sign in with the password after TOTP enrolment                | The password step requested 2FA. The session lookup returned no session until the TOTP code was verified.                         |
| Revoke sessions                                               | A second browser context holding a copy of the authenticated cookie could no longer load the session.                             |

The probe exercises Better Auth's defaults on localhost. It leaves the
Trustroots session bridge, mandatory TOTP after passkey sign-in, real devices,
MongoDB and native-client compatibility for the pilot.

Run the same probe from the repository root with Node 24 and pnpm.

```sh
probe_dir="$(mktemp -d)"
cp openspec/changes/evaluate-better-auth/probe.mjs "$probe_dir/"
(
  cd "$probe_dir" || exit
  printf '%s\n' '{"private":true,"packageManager":"pnpm@12.16.1"}' > package.json
  pnpm add --save-exact --ignore-scripts better-auth@1.7.25 @better-auth/passkey@1.7.25 @playwright/test@1.65.0
  pnpm exec playwright install chromium
  node probe.mjs
)
```

## Decision before integration

Proceed to a Trustroots web pilot only if Better Auth can resolve an enrolled
passkey to the existing member, enforce the configured factor policy before
any usable session is issued, and preserve recovery and revocation. Use a
separate local database for the pilot to make rollback routine. Keep a single
source of truth for which session grants access. Retain the mobile API until
rotation, sign-out and account-wide revocation have been verified on both
native clients.

The follow-up pilot should enrol a passkey from an existing session, verify
passkey-first sign-in, test both accepted and rejected TOTP, and confirm that
revoked sessions deny a protected request. Exercise legacy password login,
password reset and account suspension in existing server and browser suites
before considering rollout.
