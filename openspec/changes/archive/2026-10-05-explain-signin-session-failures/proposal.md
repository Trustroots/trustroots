# Explain sign-in session failures

## Why

A successful password check can return without a usable session cookie, for
example when an HTTPS proxy is misconfigured or cookies are blocked. The client
currently redirects immediately, leaving the person signed out with no explanation.

## What Changes

- Add a read-only, non-cacheable session endpoint returning only the authenticated
  account identifier, or null for an anonymous request.
- Verify that a subsequent request recognises the same account before updating
  client authentication state or redirecting after sign-in.
- Explain missing sessions without blaming the browser alone, distinguish failed
  verification requests, and allow a retry without suggesting a password reset.
- Cover server responses, client failure handling and a browser session failure
  followed by a successful retry.

## Impact

Affected modules: users authentication API, sign-in page, account-access spec.
This is additive and requires no data migration or cookie-policy changes. Deploy
server and client together so the session endpoint is available to the new client.
Sign-in adds one small same-origin request; existing return destinations remain intact.
