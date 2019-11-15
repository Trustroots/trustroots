(function () {
  angular
    .module('users')
    .factory('InvitationService', InvitationService);

  /* @ngInject */
  function InvitationService($resource) {
    return $resource('/api/users/invitecode/:invitecode', {
      invitecode: '@invitecode'
    }, {
      get: {
        method: 'GET'
      },
      post: {
        method: 'POST'
      }
    });
  }
}());
