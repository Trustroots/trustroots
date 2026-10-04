# Protect cookie mutations from cross-origin requests

## Why

Trustroots uses cookie-backed sessions, so browsers attach member sessions to
state-changing requests. Cross-site forms can therefore trigger mutations
without a member's intent, and signing out currently uses a state-changing GET.

## What Changes

- Reject state-changing requests that carry an `Origin` other than an
  explicitly configured application origin or a `Sec-Fetch-Site` value other
  than `same-origin`.
- When both browser-origin signals are absent, require JSON content or the
  dedicated request header on API mutations; cross-origin JSON requests require
  a successful CORS preflight.
- Require a dedicated custom request header on multipart upload mutations and
  sign-out requests that omit both browser-origin signals.
- Keep the check independent of untrusted `Host`, `Referer`, and
  `X-Forwarded-*` request headers.
- Keep CSP/Expect-CT violation reports and the Basic-Auth SparkPost webhook
  available to their reporting and server-to-server clients.
- Change sign-out to POST-only and update browser, Android, and iOS clients.
- Document that requests missing both browser-origin signals remain accepted
  for compatibility; this is a bounded defence-in-depth measure, not complete
  CSRF protection.

## Affected Modules

- `config` (Express state-changing request checks)
- `modules/users` (sign-out route, controller tests, account-access behaviour)
- `modules/core` (CSP reporting exemptions and browser shell sign-out)
- `modules/sparkpost` (authenticated webhook compatibility)
- `apps/android` and `apps/ios` (native sign-out method)
- `tests/e2e` (cross-origin mutation and sign-out behaviour)

## Compatibility and Deployment

Same-origin browser forms continue to work when the browser supplies Origin
or Fetch Metadata. Native clients that omit browser-origin metadata remain
compatible for JSON and receive the dedicated marker from their common request
builders; sign-out and multipart upload clients must send the marker.
Originless browser-simple API mutations and non-browser callers with an
explicit foreign Origin or non-same-origin Fetch Metadata value receive HTTP
403. This is defence in depth: originless JSON requests remain compatible, so
full CSRF protection for every client still requires a synchroniser token or
equivalent end-to-end request-header rollout.
