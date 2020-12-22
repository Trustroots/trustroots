// Users service used for communicating with the users REST endpoint
angular.module('users').factory('Users', UsersFactory);

/* @ngInject */
function UsersFactory($resource) {
  const Users = $resource(
    '/api/users',
    {},
    {
      update: {
        method: 'PUT',
      },
      get: {
        method: 'GET',
      },
      delete: {
        method: 'DELETE',
      },
      deleteConfirm: {
        method: 'DELETE',
        url: '/api/users/remove/:token',
      },
    },
  );

  angular.extend(Users, {
    deleteWithToken(token) {
      return this.deleteConfirm(
        {
          token, // api expects token as a parameter (i.e. /:token)
        },
        {
          token,
        },
      ).$promise;
    },
  });

  return Users;
}
