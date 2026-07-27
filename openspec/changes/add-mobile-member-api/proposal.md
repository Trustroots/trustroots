# Mobile member API

## Why

The native iOS app needs an API authentication mechanism that does not depend
on a browser cookie. This also lets the read-only production-copy environment
on cat run an isolated, realistic mobile login test.

## What changes

- Add pre-release `/api/mobile/v0` authentication endpoints.
- Issue short-lived opaque access tokens and rotating refresh tokens.
- Provide a token-authenticated current-member endpoint.
- Keep the existing browser session authentication unchanged.

## Scope

This first increment establishes mobile authentication only. Profile, map,
messages and other mobile resources will move to this API in later changes.
