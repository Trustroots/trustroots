angular
  .module('users')
  .factory('UserMembershipsService', UserMembershipsService);

/* @ngInject */
function UserMembershipsService($resource) {
  return $resource(
    '/api/users/memberships/:tribeId?',
    {
      tribeId: '@tribeId',
    },
    {
      post: {
        method: 'POST',
      },
      delete: {
        method: 'DELETE',
      },
      get: {
        method: 'GET',
      },
    },
  );
}
