# Design

Node.js 24 supports synchronous CommonJS `require()` of ESM modules without top-level await. `server.js` and `worker.js` therefore remain one-line adapters that load their `.mjs` implementations for existing deployment commands. The implementations import their existing CommonJS config services as default values. The worker's database connection, model loading, job unlock and worker start remain in the same waterfall order, with unchanged failure logging and exit status.

This moves the process entry implementations without changing package-wide module mode. Config loaders, scripts, tests and `.js` adapters still need a later migration before `"type": "module"` is safe.
