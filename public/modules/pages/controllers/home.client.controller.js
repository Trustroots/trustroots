'use strict';


angular.module('pages').controller('HomeController', ['$scope', '$state', 'Authentication',
  function($scope, $state, Authentication) {

    // Redirect logged-in users out from front page
    if( Authentication.user ) {
      $state.go('search');
    }

  }
]);
