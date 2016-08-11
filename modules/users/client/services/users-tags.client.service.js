(function () {
  'use strict';

  angular
    .module('users')
    .factory('UserTagsService', UserTagsService);

  /* @ngInject */
  function UserTagsService($resource) {
    return $resource('/api/users/tags', {}, {
      update: {
        method: 'PUT'
      },
      delete: {
        method: 'DELETE'
      },
      post: {
        method: 'POST'
      }
    });
  }

}());
