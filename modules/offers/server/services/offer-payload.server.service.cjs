// Keep synchronous CommonJS access to the native TypeScript implementation.
const implementation = require('./offer-payload.server.service.mts');
exports.prepareNewOffer = implementation.prepareNewOffer;
exports.prepareOfferMutationResponse =
  implementation.prepareOfferMutationResponse;
exports.prepareOfferPayload = implementation.prepareOfferPayload;
exports.prepareOfferSearchResults = implementation.prepareOfferSearchResults;
exports.prepareOfferUpdate = implementation.prepareOfferUpdate;
