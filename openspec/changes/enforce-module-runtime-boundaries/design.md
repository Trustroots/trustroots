# Design

Reuse `source-imports.mts` for production source enumeration, literal import
parsing, and canonical resolution. Classify source ownership by the `client`,
`server` or `shared` directory beneath a module. For imports through a workspace
package name, classify the tier from its explicit subpath (`client/...`,
`server/...`, or `shared/...`). Imports to the importing module's own package
root have no runtime tier and are left to the existing export and module graph
checks.

The forbidden pairs are client → server, server → client, shared → client and
shared → server. A shared source file may use its own shared code. Client and
server code may use shared code. Existing tier-specific module exports and
package graph rules continue to govern dependencies between modules.

Wire the guard and its fixtures into `lint:boundaries` and
`lint:boundaries:test`, which already run in repository lint and CI.
