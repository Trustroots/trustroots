const Module = require('module');

const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveFilename(request) {
  if (request === 'canvas') {
    const error = new Error("Cannot find module 'canvas'");
    error.code = 'MODULE_NOT_FOUND';
    throw error;
  }

  return originalResolveFilename.apply(this, arguments);
};
