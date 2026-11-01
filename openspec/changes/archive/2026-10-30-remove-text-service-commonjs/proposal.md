## Why

The native ESM runtime migration retained CommonJS export shapes for existing tests. The text service now has only two direct CommonJS test consumers, so its compatibility export and JavaScript wrapper can be removed as the first slice of #3494.

## What Changes

- Migrate the text service unit suite to native ESM and its remaining message-controller test consumer to an ESM import.
- Point all text service consumers directly at the owning TypeScript implementation and remove its `.mjs` wrapper and `module.exports` export.
- Preserve the default service object, named functions and sanitisation behaviour.

## Impact

Affected modules: core, admin, contacts, experiences, messages, offers, support, tribes and users. Cross-module dependencies remain the same; only implementation paths change. There is no user-facing behaviour change, data migration or deployment configuration change. Internal consumers must use the `.mts` path. Existing behavioural and end-to-end tests remain applicable; new end-to-end coverage is unnecessary for this module-format cleanup.
