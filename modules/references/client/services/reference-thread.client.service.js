(function() {
  'use strict';

  // Offers service used for communicating with the offers REST endpoints
  // Read offer by offerId
  angular
    .module('references')
    .factory('ReferenceThreadService', ReferenceThreadService);

  /* @ngInject */
  function ReferenceThreadService($resource) {
    return $resource('/api/references/threads/:userToId', {
      userToId: '@_id'
    }, {
      get: {
        method: 'GET'
      }
    });
  }

})();
