(function () {
  'use strict';

  // Users service used for communicating with the users REST endpoint
  angular
    .module('users')
    .factory('Users', UsersFactory);

  /* @ngInject */
  function UsersFactory($resource) {
    return $resource('/api/users', {}, {
      update: {
        method: 'PUT'
      },
      get: {
        method: 'GET'
      }
    });
  }

}());
