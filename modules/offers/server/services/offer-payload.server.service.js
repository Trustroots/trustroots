// Load through CommonJS so NYC instruments the native ESM implementation.
const implementation = require('./offer-payload.server.service.mjs');
exports.prepareNewOffer = implementation.prepareNewOffer;
exports.prepareOfferMutationResponse =
  implementation.prepareOfferMutationResponse;
exports.prepareOfferPayload = implementation.prepareOfferPayload;
exports.prepareOfferSearchResults = implementation.prepareOfferSearchResults;
exports.prepareOfferUpdate = implementation.prepareOfferUpdate;
