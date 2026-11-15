## Design

The native app owns session restoration, credential persistence, token refresh,
API transport, caches and signing. Adapters project native API models into
common presentation models. Swift uses callback-based Kotlin framework exports.
The shared Compose app owns screens, screen history, loading, pagination, reply
state and cancellation of obsolete results. Account changes rebuild the shared
screen state. Compose leaves maps, onboarding, alerts and embedded browsers
with the native app.

Use the existing API clients for this comparison so the assessment can isolate
shared UI and Swift/Kotlin interoperability from a subsequent transport migration.
The Android adapter reuses the native draft store. Keep the native entry points
as defaults until usability, offline behaviour and release checks are complete.
