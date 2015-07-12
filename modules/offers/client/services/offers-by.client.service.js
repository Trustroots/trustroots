(function() {
  'use strict';

  // OffersBy service used for communicating with the offers REST endpoints
  // Read offers by userId
  angular
    .module('offers')
    .factory('OffersBy', OffersBy);

  /* @ngInject */
  function OffersBy($resource) {
    return $resource('/api/offers-by/:userId', {
      userId: '@id'
    }, {
      update: {
        method: 'PUT'
      }
    });
  }

})();
