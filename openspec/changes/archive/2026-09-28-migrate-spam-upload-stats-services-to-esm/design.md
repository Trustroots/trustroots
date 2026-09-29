## Approach

Each implementation exposes named functions and a default service object. The existing CommonJS path returns that default object using synchronous Node.js 24 `require()`. No top-level await is permitted. Statistics imports the shared Influx default object through its CommonJS adapter so replacements remain visible and NYC instruments the implementation through its require hooks. Direct ESM-to-ESM imports bypass those hooks; removing this bridge requires coverage tooling that instruments native ESM dependencies. Influx measurement writing accesses the same object's `_getClient` method.

Tests replace dependencies at their supported boundary rather than assuming proxyquire intercepts native ESM imports. Preserve classifications, upload status codes, temporary-file cleanup, statistics validation and measurement payloads.

The earlier namespace-adapter constraint applies to modules that return ESM namespaces. This batch returns mutable plain objects to preserve existing replacement semantics. Remove adapters only after all consumers and tooling migrate.
