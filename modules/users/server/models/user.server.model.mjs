import { createRequire } from 'node:module';

// Keep password hashing and legacy-hash migration in one schema registration.
const require = createRequire(import.meta.url);
const defaultExport = require('./user.server.model.js');

export default defaultExport;
