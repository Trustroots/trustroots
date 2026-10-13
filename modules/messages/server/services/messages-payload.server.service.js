// Load through CommonJS so NYC instruments the native ESM implementation.
const implementation = require('./messages-payload.server.service.mjs');
exports.prepareNewMessageFields = implementation.prepareNewMessageFields;
exports.prepareMessageForClient = implementation.prepareMessageForClient;
exports.prepareThreadSummary = implementation.prepareThreadSummary;
exports.prepareMarkReadSelector = implementation.prepareMarkReadSelector;
exports.prepareMarkReadResponse = implementation.prepareMarkReadResponse;
exports.prepareUnreadMessageCount = implementation.prepareUnreadMessageCount;
exports.preparePreviewMessageResponse =
  implementation.preparePreviewMessageResponse;
