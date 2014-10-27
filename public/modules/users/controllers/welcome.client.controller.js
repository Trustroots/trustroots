'use strict';

angular.module('users').controller('WelcomeController', ['$scope', '$state', 'Authentication',
  function($scope, $state, Authentication) {

    // If user is not signed in then redirect to login
    if (!Authentication.user) $state.go('signin');

  }
]);
