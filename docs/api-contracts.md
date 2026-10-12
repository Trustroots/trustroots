# Shared API contracts

Production client modules use TypeScript. Shared API contracts live alongside
their features in `modules/*/shared/` and contain only types, so the JavaScript
server does not need a TypeScript runtime.

`npm run typecheck` checks client code, TypeScript test fixtures and the opted-in
server payload builders in `tsconfig.contracts.json`. The latter uses strict
`checkJs` with JSDoc imports of the same contracts used by the client. It does
not enable checking across the legacy server tree.

The checked builders retain thin CommonJS adapters (`.cjs`, or `.js` in a
CommonJS package scope) for existing CommonJS tests. Server controllers import
the native ESM implementations directly. The server coverage loader instruments
those implementations through either entry point.

The enforced boundaries are:

- Staff blockers: `StaffBlocker` is constructed by the checked server helper and
  consumed by the administration client API.
- Experiences: create-request fields, private/public feedback, reciprocal
  response fields and counts use shared types. Server identifiers and dates
  retain their native types until Express serialises them; client contracts use
  string identifiers and timestamps. Private feedback can be absent, and a
  reciprocal response is not a complete experience with member identities.
- Messages: send, mark-read and preview requests, messages, inbox excerpts,
  unread counts and preview responses share types. Deleted participants can
  have only an identifier or be absent. Pagination headers remain separate;
  a native URL helper extracts the next relation, retaining repeated query
  values and the existing 2,000-character header limit.
- Offers: editable create/update fields, sanitised read responses, mutation
  confirmations and GeoJSON search results use separate contracts. Search
  builders distinguish database latitude/longitude tuples from GeoJSON
  longitude/latitude tuples. Existing location and contact filtering stays in
  the controller.
- Profiles: editable update fields, public, own and mini-profile responses have
  separate types. Email updates retain their separate confirmation flow. Public
  profiles omit account-only fields and the access-control flag. Mini profiles
  describe the existing projection, including its `blocked` field.

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

All module client tests and client-specific helpers use TypeScript and are
included in `tsconfig.tests.json`. Fixtures and mocks should use the actual API
or component types. Deliberately malformed runtime inputs belong at an explicit
test boundary, using the helpers in `testutils/client/malformed-fixtures.ts`,
rather than weakening production types. Shared JavaScript server/common test
utilities are checked separately in `tsconfig.fixtures.json`. Their data helpers
use TypeScript with thin CommonJS entry points for legacy server tests. Node 24
loads the implementations using its built-in type stripping; no runtime compiler
package or production compilation step is required. Fixture sources must use
erasable TypeScript syntax. Jest searches the module tree to avoid discovering
duplicate packages in local worktrees.
