## Why

The client TypeScript rollout and the initial shared types in #2953 are complete,
but the server JSDoc references are not checked by CI. Response shapes can still
drift between the server and client. The experience client also describes a
reciprocal response as a full experience even though the server deliberately
omits its member and visibility fields.

## What Changes

- Check the server payload construction for staff blockers and experiences under
  strict TypeScript, using shared request and response contracts.
- Describe full, private and reciprocal experience payloads accurately and reuse
  them in the client API and components.
- Add the contract check to the existing blocking typecheck command and include
  negative compiler regressions that demonstrate client and server drift fails.
- Preserve HTTP responses, privacy filtering, database behaviour and module paths.

## Impact

Affected modules: admin, experiences, developer tooling and their tests. This is
an incremental contract enforcement step, not a server TypeScript runtime change
or a conversion of every API endpoint. There is no user-facing functionality,
data migration or deployment change. Existing browser flows remain applicable;
compiler regressions are the appropriate additional coverage for this tooling.
