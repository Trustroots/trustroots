# Design

The application package uses native ESM. Migrated implementation paths use explicit extensions. Build and test tools that require CommonJS have explicit `.cjs` or local package boundaries rather than determining the application module mode.

Models must be imported before modules that call `mongoose.model()` at module initialisation. Bootstrap and the worker therefore await discovery, then import controllers/configuration and jobs. Discovery remains ordered so the core catch-all routes are registered last.

Default service objects retain identity and mutability. Node 24 native `module.exports` export interoperability permits CommonJS test tooling to consume these objects directly without JavaScript adapter files. Tests still exercise native ESM implementations. Tests requiring dependency substitution use synchronous Node module hooks and isolated module URLs rather than proxyquire.

Native ESM coverage instrumentation runs through Node module load hooks before application modules load. It preserves module syntax and records Istanbul counters for the existing report and thresholds; models and the existing intentional exclusions remain excluded.

Operational local configuration needs a documented CommonJS compatibility boundary because deployed `local.js` files are user-owned. This boundary must not permit CommonJS to re-enter the server implementation tree.
