'use strict';


angular.module('pages').controller('HomeController', ['$scope', '$state', '$timeout', 'Authentication',
  function($scope, $state, $timeout, Authentication) {

    // Redirect logged-in users out from front page
    if( Authentication.user ) {
      $state.go('search');
    }

  }
]);
