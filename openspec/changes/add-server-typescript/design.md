# Design

## Execution

Node 24 strips erasable TypeScript syntax from `.mts` files at load time. Enums, namespaces and parameter properties are not used (`erasableSyntaxOnly`), and `verbatimModuleSyntax` forces `import type` for type-only imports. Importers use the real `.mts` specifier, which `allowImportingTsExtensions` permits under `noEmit`. `require()` of a typed module uses the same Node 24 interoperability as `.mjs`, including the `module.exports` named export.

## Type checking

`tsconfig.server.json` includes only `.mts` server files with `allowJs` on and `checkJs` off, so JavaScript imports are resolved but not diagnosed. Imported JavaScript that cannot be inferred usefully (the configuration object, the logger) gets a sibling `.d.mts` declaration. Errors only surface at typed call sites; JavaScript callers stay unchecked until their module is converted.

## Coverage

`scripts/coverage/native-esm.mjs` reads `.mts` through `module.stripTypeScriptTypes` in strip mode, which replaces types with whitespace and so preserves line and column positions. The load hook accepts `module-typescript` results and returns instrumented JavaScript as `module`. `.nycrc-server` includes `.mts` and keeps its existing exclusions.

## Formatting

Prettier 2.6.2's TypeScript parser cannot parse `export { x as 'module.exports' }`. Server `.mts` files use its `babel-ts` parser through a `.prettierrc.json` override rather than upgrading Prettier here.
