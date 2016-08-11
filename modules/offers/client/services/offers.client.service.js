(function () {
  'use strict';

  // Offers service used for communicating with the offers REST endpoints
  // Read offer by offerId
  angular
    .module('offers')
    .factory('OffersService', OffersService);

  /* @ngInject */
  function OffersService($resource) {
    return $resource('/api/offers/:offerId', {
      offerId: '@id'
    }, {
      get: {
        method: 'GET'
      }
    });
  }

}());
