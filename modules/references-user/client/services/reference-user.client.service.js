(function () {
  'use strict';

  // ContactsList factory used for communicating with the contacts REST endpoints
  // Read contact list by userId
  angular
    .module('references-user')
    .factory('ReferenceUserService', ReferenceUserService);

  /* @ngInject */
  function ReferenceUserService($resource) {
    return $resource('/api/references/user/:userId', {
      userId: '@id'
    });
  }

}());
