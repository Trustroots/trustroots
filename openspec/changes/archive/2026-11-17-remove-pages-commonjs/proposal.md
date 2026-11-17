## Why

The pages module still exposes `module.exports` exports from its controllers and routes so that its three CommonJS server tests and a CommonJS interoperability check can `require()` them. Migrating those consumers lets the module use ordinary ESM exports, continuing #3494 after the text service.

## What Changes

- Migrate the pages controller and route suites from `.cts`/`require()` to `.mts` ESM imports.
- Remove the `module.exports` exports from the greeters and volunteers controllers and the pages routes, and the routes' unused named `registerRoutes` export.
- Drop the pages entries from the administration CommonJS interoperability test and let the route registration unit test read the default export of ES modules without a `module.exports` export.
- Add a lint rule that rejects `module.exports` exports in modules whose CommonJS consumers have migrated: the pages server code and the text service.

## Impact

Affected modules: pages, plus test helpers in admin and core. Cross-module dependencies are unchanged. There is no user-facing behaviour change, data migration or deployment configuration change. The controllers keep their default service object, which the route unit test stubs, and their named `list` export. Existing behavioural and end-to-end tests remain applicable; new end-to-end coverage is unnecessary for this module-format cleanup.
