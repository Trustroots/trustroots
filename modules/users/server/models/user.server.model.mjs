import { createRequire } from 'node:module';

// Keep password hashing and legacy-hash migration in one schema registration.
const require = createRequire(import.meta.url);
// The CommonJS model owns the shared schema registration during migration.
// eslint-disable-next-line import/no-commonjs
const defaultExport = require('./user.server.model.js');

export default defaultExport;
