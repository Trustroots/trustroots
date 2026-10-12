// Load through CommonJS so NYC instruments the native ESM implementation.
const implementation = require('./experience-payload.server.service.mjs');
exports.prepareExperienceCount = implementation.prepareExperienceCount;
exports.prepareNewExperience = implementation.prepareNewExperience;
exports.prepareSendingToClient = implementation.prepareSendingToClient;
