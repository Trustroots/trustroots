(function () {
  'use strict';

  // ContactsList factory used for communicating with the contacts REST endpoints
  // Read contact list by userId
  angular
    .module('references')
    .factory('ReferencesService', ReferencesService);

  /* @ngInject */
  function ReferencesService($resource) {
    return $resource('/api/references/:userToId', {
      userToId: '@userToId'
    }, {
      save: {
        method: 'POST'
      },
      query: {
        method: 'GET',
        isArray: true
      }
    });
  }

}());
