## Why

Messages, offers and profiles currently declare client types separately from server payload construction. Several declarations are overly permissive or inaccurate, and JavaScript client tests cannot enforce their fixtures against those types.

## What Changes

- Share request and response contracts for browser-facing message, offer and profile APIs and check their pure server builders with strict JSDoc.
- Correct offer-search typing to describe its existing GeoJSON response and distinguish profile visibility and deleted message participants.
- Convert all remaining module client tests and client-specific helpers to strict TypeScript with typed mocks and fixtures.
- Preserve runtime validation, privacy rules, HTTP responses, test assertions and coverage requirements.
- Remove redundant direct dependencies and replace the message client's Link-header dependency with a typed pagination helper using native URL parsing, retaining relative links, relation selection, repeated query values and the existing header length limit.

## Impact

Affected modules: messages, offers, users and client test tooling across modules. No database migration, runtime TypeScript, runtime schema validator or deployment change is required. Authentication/session, message sync and profile-search contracts remain outside this change. Existing end-to-end scenarios verify unchanged behaviour; no new user-facing functionality is introduced.
