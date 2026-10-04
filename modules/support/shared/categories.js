// Keep the CommonJS adapter for server callers. Browser code imports the JSON
// module so Vite can serve this shared data as a native module.
exports.SUPPORT_CATEGORIES = Object.freeze(require('./categories.json'));
