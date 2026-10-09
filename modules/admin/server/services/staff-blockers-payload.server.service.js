// Load through CommonJS so NYC instruments the native ESM implementation.
const implementation = require('./staff-blockers-payload.server.service.mjs');
exports.prepareStaffBlockers = implementation.prepareStaffBlockers;
