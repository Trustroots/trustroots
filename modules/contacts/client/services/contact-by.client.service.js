(function() {
  'use strict';

  // ContactBy factory used for communicating with the contacts REST endpoints
  // Read contact by userId
  angular
    .module('contacts')
    .factory('ContactByResource', ContactByResource);

  /* @ngInject */
  function ContactByResource($resource) {
    return $resource('/api/contact-by/:userId', {
      userId: '@id'
    }, {
      get: {
        method: 'GET'
      }
    });
  }

})();
