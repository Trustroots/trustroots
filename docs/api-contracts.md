# Shared API contracts

Production client modules use TypeScript. Shared API contracts live alongside
their features in `modules/*/shared/` and contain only types, so the JavaScript
server does not need a TypeScript runtime.

`npm run typecheck` checks client code, TypeScript test fixtures and the opted-in
server payload builders in `tsconfig.contracts.json`. The latter uses strict
`checkJs` with JSDoc imports of the same contracts used by the client. It does
not enable checking across the legacy server tree.

The checked builders retain thin `.js` adapters because NYC currently instruments
their native ESM implementations when they are loaded through CommonJS. Server
controllers and tests use these adapters; the implementations themselves remain
native ESM. Remove the adapters only when coverage instrumentation supports the
direct native ESM import path.

The initial enforced boundaries are:

- Staff blockers: `StaffBlocker` is constructed by the checked server helper and
  consumed by the administration client API.
- Experiences: create-request fields, private/public feedback, reciprocal
  response fields and counts use shared types. Server identifiers and dates
  retain their native types until Express serialises them; client contracts use
  string identifiers and timestamps. Private feedback can be absent, and a
  reciprocal response is not a complete experience with member identities.

The server controller passes database results to these builders. Checking the
builders catches errors in their payload construction, but does not type-check
the surrounding controllers, database queries or untrusted HTTP input. Existing
runtime validation and privacy checks remain necessary. Server runtime TypeScript
is tracked separately in #2885.

Compiler regression tests modify the real builder source in memory and verify
that omitted fields and incompatible values produce diagnostics. Compile-only
client fixtures use `@ts-expect-error` to verify invalid requests and unsafe
response access remain rejected; they perform no HTTP requests.

When extending this pattern, add a shared contract, use it in both the client and
the server payload implementation, include that implementation in the contract
configuration, and cover its runtime behaviour and deliberate type errors.
Broader endpoint and database typing can proceed incrementally without reopening
the completed client migration or changing the server runtime.
