import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const defaultExport = require('./local.js');

export default defaultExport;
