## Why

The first server ESM migration moved the text service behind an ESM
implementation while preserving its CommonJS entry point. The same incremental
approach can move another isolated server service without converting the whole
application at once.

## What Changes

- Move the JSON-for-script serialisation implementation to a native ESM module.
- Keep the existing CommonJS service path as a compatibility adapter for
  current server consumers.
- Include the ESM file in the existing server lint and coverage configuration.

## Capabilities

### Modified Capabilities

- `runtime-platform`: Server services can expose native ESM implementations
  while existing CommonJS consumers migrate incrementally.

## Impact

This affects the bootstrap serialisation service and its module loading only.
Its output contract, HTTP behaviour, persisted data, and deployment commands
remain unchanged.
