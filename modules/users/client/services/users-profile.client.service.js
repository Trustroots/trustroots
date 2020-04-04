angular.module('users').factory('UserProfilesService', UserProfilesService);

/* @ngInject */
function UserProfilesService($resource) {
  return $resource(
    '/api/users/:username',
    {
      username: '@username',
    },
    {
      get: {
        method: 'GET',
      },
    },
  );
}
