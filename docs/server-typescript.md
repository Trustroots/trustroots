# Server TypeScript

Server TypeScript uses `tsconfig.server.json` and `npm run typecheck:server`.
The aggregate `npm run typecheck` command includes this check in CI.

Node 24 executes the opted-in `.cts` modules by stripping erasable TypeScript
syntax. Keep runtime code to erasable types: avoid enums, parameter properties,
runtime namespaces, path aliases and JSX. Node does not read `tsconfig.server.json`
or type-check at runtime. Existing `.js` adapters retain the paths used by
CommonJS callers.

The authentication service and build-metadata helper are the first runtime
modules. Their tests exercise the adapters and the typed implementations.
