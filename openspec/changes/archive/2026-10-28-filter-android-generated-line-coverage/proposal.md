## Why

The Android report attributes executable source lines to compiler-generated
exhaustive-enum fallbacks, implicit coroutine completion and forwarding methods
for callable references. These instructions do not represent source behaviour.
Members' application code must remain fully represented in the coverage gate.

## What Changes

- Identify only proven generated instruction sequences using compiled bytecode.
- Preserve the original JaCoCo report and publish an audit of each correction.
- Remove only proven generated instructions before aggregating line counters;
  retain uncertain instructions and all application decisions.
- Add tests for reachable line gaps and consolidate duplicated host checks.

## Capabilities

### Modified Capabilities

- `developer-tooling`: Auditable Android line coverage for executable source.

## Impact

Android coverage reporting and its tests change. Runtime behaviour, dependency
versions, database state and deployment configuration do not change. Raise the
line baseline to 100% only after a full measurement reaches it, preserving
the branch floor. Browser end-to-end testing is unsuitable for bytecode reporting;
classifier regression tests and the full Android suite provide verification.
