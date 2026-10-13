## Why

Signup and support requests should use the existing shared request counters,
with operation-specific policies that apply before persistence and email delivery.

## What Changes

- Apply signup limits by client IP and normalised recipient email address.
- Apply support limits by client IP and, when signed in, member identity.
- Reuse hashed MongoDB counters, bounded windows, HTTP 429 and Retry-After.
- Retain explicit signup field selection and enforce member blocks on contact requests.

## Impact

Affected modules: core, users, contacts and support. No database migration or new
dependency is required; the existing request-limit TTL index remains required.
Normal signup and support flows remain available. Excess requests receive HTTP 429. Production policies are configurable; test policies preserve existing suites.
