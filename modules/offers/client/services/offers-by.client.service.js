// OffersBy service used for communicating with the offers REST endpoints
// Read offers by userId
// Accepts also `type` parameter
angular.module('offers').factory('OffersByService', OffersByService);

/* @ngInject */
function OffersByService($resource) {
  return $resource(
    '/api/offers-by/:userId',
    {
      userId: '@id',
    },
    {
      query: {
        method: 'GET',
        isArray: true,
      },
    },
  );
}
