# Design

The `.mjs` implementation imports Moment and exports the same callable function as both a named export and default export. The `.js` adapter synchronously returns the default export, preserving Node.js 24 CommonJS consumers and existing test coverage instrumentation. The controller keeps its adapter import until native ESM instrumentation and CommonJS consumer migration allow direct imports throughout.

ESLint applies the import plugin's CommonJS and dynamic-require rules only to native server `.mjs` files. The strategy loader in `users.config.server.mjs` remains synchronous because Passport configuration currently requires immediate registration. Four JSON loads retain `createRequire` because the pinned Prettier version cannot parse native JSON import attributes. Their rule exceptions are local and documented. Package-wide `type: module` remains deferred because bootstrap, adapters, tests and scripts still use CommonJS `.js` entry points.
