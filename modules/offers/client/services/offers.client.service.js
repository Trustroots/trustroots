(function() {
  'use strict';

  // Offers service used for communicating with the offers REST endpoints
  // Read offer by offerId
  angular
    .module('offers')
    .factory('Offers', Offers);

  /* @ngInject */
  function Offers($resource) {
    return $resource('/api/offers/:offerId', {
      offerId:'@id'
    }, {
      get: {
        method: 'GET'
      }
    });
  }

})();
