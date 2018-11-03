(function () {
  'use strict';

  // Reference thread service used for communicating with the REST endpoints
  // Read reference by userToId
  angular
    .module('references-thread')
    .factory('ReferenceThreadService', ReferenceThreadService);

  /* @ngInject */
  function ReferenceThreadService($resource) {
    return $resource('/api/references-thread/:userToId', {
      userToId: '@_id'
    }, {
      get: {
        method: 'GET'
      }
    });
  }

}());
