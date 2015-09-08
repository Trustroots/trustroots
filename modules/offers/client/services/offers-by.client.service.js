(function() {
  'use strict';

  // OffersBy service used for communicating with the offers REST endpoints
  // Read offers by userId
  angular
    .module('offers')
    .factory('OffersByService', OffersByService);

  /* @ngInject */
  function OffersByService($resource) {
    return $resource('/api/offers-by/:userId', {
      userId: '@id'
    }, {
      update: {
        method: 'PUT'
      }
    });
  }

})();
