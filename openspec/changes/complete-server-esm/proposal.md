# Complete the server ESM migration

## Why

Issue #2857 remains open because configuration, discovery, worker job loading and CommonJS adapters still control the server runtime. Native imports must preserve model registration order and the complete coverage gate before those adapters can be removed.

## What Changes

- Use native ESM for configuration, application bootstrap, server implementations and operational entry points.
- Replace synchronous runtime discovery with ordered, awaited imports; register models before importing controllers, routes or worker jobs.
- Remove server CommonJS adapters and point consumers at their native implementations.
- Establish explicit CommonJS boundaries for third-party build/test tools and legacy local deployment configuration; enable package-wide ESM for application code.
- Preserve mutable default service objects for test stubbing and use Node 24's native CommonJS interoperability for remaining test-tool consumers.
- Instrument native ESM loads so existing server coverage remains at 100%, and replace CommonJS-only dependency mocking with native module hooks.
- Enforce the completed runtime boundary and verify server, worker, client, production build and end-to-end behaviour.

## Impact

Affected specification: runtime-platform. Server/configuration discovery becomes asynchronous internally. Public HTTP behaviour, deployed launch commands and database schema remain compatible. Server TypeScript (#2885) is outside this migration.
