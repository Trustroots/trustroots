(function () {
  'use strict';

  // Authentication service for user variables
  angular
    .module('users')
    .factory('Authentication', Authentication);

  /* @ngInject */
  function Authentication($window) {
    var auth = {
      user: $window.user || null
    };
    return auth;
  }

}());
