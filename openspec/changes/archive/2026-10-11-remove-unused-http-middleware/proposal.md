# Remove unused HTTP middleware

## Why

The application does not consume flash messages or send method override headers.
Express already supplies the request body parsers needed by existing routes.

## What Changes

- Remove the unused flash middleware and its direct dependency.
- Remove method override middleware and its direct dependency. HTTP routes use
  the actual request method; `X-HTTP-Method-Override` no longer changes it.
- Use Express JSON and URL-encoded parsers with the existing options, including
  support for CSP report bodies, and remove the direct `body-parser` dependency.

## Impact

Clients relying on method override headers must send the actual HTTP method.
No first-party client uses the override. Express retains its own body-parser
dependency, so removing the direct declaration does not remove every copy.
Request parsing and authenticated flows will be checked through regression
tests and the existing server and end-to-end suites.
