/* istanbul ignore file -- implementation is covered through the CommonJS adapter. */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const defaultExport = require('./local.js');

export default defaultExport;
