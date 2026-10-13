// Load through CommonJS so NYC instruments the native ESM implementation.
const implementation = require('./experience-payload.server.service.mts');
exports.prepareExperienceCount = implementation.prepareExperienceCount;
exports.prepareNewExperience = implementation.prepareNewExperience;
exports.prepareSendingToClient = implementation.prepareSendingToClient;
