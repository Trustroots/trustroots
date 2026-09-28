// Keep the existing CommonJS entry point while consumers migrate to ESM.
module.exports = require('./json-for-script.server.service.mjs').jsonForScript;
