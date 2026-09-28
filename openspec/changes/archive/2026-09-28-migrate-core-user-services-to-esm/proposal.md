## Why

The first server ESM migration moved the text service behind an ESM
implementation while preserving its CommonJS entry point. A broader set of
core and user services can follow the same pattern while existing server
consumers continue to use their current imports.

## What Changes

- Move JSON bootstrap serialisation, in-memory route permissions, and error
  responses in core to native ESM implementations.
- Move signup safety and user roles in users to native ESM implementations.
- Keep each existing CommonJS service path as a compatibility adapter for
  current server consumers, including callable and object export shapes.
- Exercise both native ESM imports and existing CommonJS imports in service
  tests. Include the new files in server lint and coverage.

## Capabilities

### Modified Capabilities

- `runtime-platform`: Server services can expose native ESM implementations
  while existing CommonJS consumers migrate incrementally.

## Impact

This affects module loading for five server services. Their output contracts,
HTTP behaviour, route permissions, persisted data, and deployment commands
remain unchanged. The package-wide CommonJS default remains in place.
