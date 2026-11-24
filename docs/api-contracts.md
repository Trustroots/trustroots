# Shared API contracts

Production client modules use TypeScript. Shared API contracts live alongside
their features in `modules/*/shared/` and contain only types, so the JavaScript
server does not need a TypeScript runtime.

`pnpm run typecheck` checks client code, TypeScript test fixtures and the opted-in
server payload builders in `tooling/tsconfig/contracts.json`. The latter uses strict
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

The native bearer profile endpoint, `GET /api/mobile/v0/profiles/:username`,
returns `profile.nostrNpub` only to that member or an administrator. The value is
the linked public key string, or explicit `null` when no key is linked. Other
members' mobile profile responses omit the field. This additive field lets native
clients compare a device-local public key with the live profile without exposing
private-key material or changing the public profile contract. Older native
clients can ignore it; the sign-in and `/api/mobile/v0/me` member shapes remain
unchanged.

To link a local key, send `{ nostrNpub }` to the bearer-authenticated
`POST /api/mobile/v0/profile/nostr/challenge`. The response contains the
unsigned ownership `event` used by the website. Sign it on device and send
`{ nostrNpub, nostrProof }` to `PUT /api/mobile/v0/profile`. The proof expires
after five minutes and is consumed once. The profile route rejects a key
already linked to another member. Send `{ nostrNpub: "" }` to unlink without
changing local key storage.

The bearer-authenticated `GET /api/mobile/v0/nostranslation/alerts` returns
`{ androidVapidKey, ios }` for available notification transports. Send the
client public key as `author`, the separate device transport public key as
`transport`, and a `destination` to `POST /api/mobile/v0/nostranslation/alerts/challenge`.
The destination contains `{ platform: "android", endpoint, publicKey, auth }`
for UnifiedPush or `{ platform: "ios", token }` for APNs.

Sign the returned kind 27235 event with the transport key. The payload digest
binds the client key, transport key, platform and destination fields in the
order above. Each string is prefixed by its UTF-8 byte length and a colon
before concatenation and SHA-256 hashing. Send the original registration and
the signed `proof` to `PUT /api/mobile/v0/nostranslation/alerts`. The
challenge is single-use and expires after two minutes. Use
`DELETE /api/mobile/v0/nostranslation/alerts` with `{ transport }` to unregister.
When opening a notification, the app can post `{ transport }` to
`/api/mobile/v0/nostranslation/alerts/pending` using the same mobile session.
It returns `{ events }` with up to eight unexpired, signed and encrypted
envelopes for that transport. The device validates and decrypts them locally.

Challenge and registration writes share a per-member allowance across mobile
sessions. Unregistering remains available when the allowance is exhausted.

Before enabling alerts, create and verify the expiry indexes in the target
database. Production does not create them automatically.

```sh
pnpm run ensure-indexes NostranslationAlertRegistration
pnpm run ensure-indexes NostranslationAlertChallenge
pnpm run ensure-indexes NostranslationAlertClaim
pnpm run ensure-indexes RequestLimit
```

Verify the alert collections each have an `expiresAt` TTL index with
`expireAfterSeconds: 0` and the request-limit collection has its unique key
and TTL indexes. Verify an alert opens its unexpired review with a closed app
on the target relay before setting `TRUSTROOTS_NOSTRANSLATION_ALERTS=true`.
UnifiedPush uses the existing VAPID settings and endpoint host allowlist. APNs
requires `TRUSTROOTS_APNS_TEAM_ID`, `TRUSTROOTS_APNS_KEY_ID`,
`TRUSTROOTS_APNS_TOPIC` and `TRUSTROOTS_APNS_PRIVATE_KEY` containing the PEM
signing key. Set `TRUSTROOTS_APNS_SANDBOX=true` when using development device
tokens. Notifications contain a generic prompt and expire with the envelope.

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
included in `tooling/tsconfig/tests.json`. Fixtures and mocks should use the actual API
or component types. Deliberately malformed runtime inputs belong at an explicit
test boundary, using the helpers in `testutils/client/malformed-fixtures.ts`,
rather than weakening production types. Shared JavaScript server/common test
utilities are checked separately in `tooling/tsconfig/fixtures.json`. Their data helpers
use TypeScript with thin CommonJS entry points for legacy server tests. Node 24
loads the implementations using its built-in type stripping; no runtime compiler
package or production compilation step is required. Fixture sources must use
erasable TypeScript syntax.
