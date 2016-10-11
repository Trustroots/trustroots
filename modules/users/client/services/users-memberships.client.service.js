(function () {
  'use strict';

  angular
    .module('users')
    .factory('UserMembershipsService', UserMembershipsService);

  /* @ngInject */
  function UserMembershipsService($resource) {
    return $resource('/api/users/memberships/:type', {
      type: '@type'
    }, {
      post: {
        method: 'POST'
      }
    });
  }

}());
