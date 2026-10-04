## Why

The current session middleware permits non-secure cookies, omits explicit SameSite policy, and persists untouched sessions. Respect the existing HTTPS deployment setting, explicitly use HttpOnly and SameSite=Lax, and avoid uninitialised saves and unconditional rewrites.

## What Changes

- Session cookies and persistence. HTTPS is required by configuration; forwarded
  protocol is trusted for session-cookie decisions only when `sessionProxy` is
  explicitly enabled for a controlled frontend.
- Add focused regression tests and preserve coverage requirements.

## Capabilities

### Modified Capabilities

- `account-access`: Session cookies and persistence.

## Impact

Keep the 28-day lifetime and MongoDB session collection. HTTPS frontends using
`sessionProxy` must overwrite X-Forwarded-Proto and prevent direct access to the
application. Direct TLS termination does not need that setting. Existing
stored sessions remain compatible. CSRF token protection is a separate
follow-up.
