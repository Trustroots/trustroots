'use strict';


angular.module('pages').controller('HomeController', ['$scope', '$state', '$timeout', 'Authentication',
  function($scope, $state, $timeout, Authentication) {

    // Redirect logged-in users out from front page
    if( Authentication.user ) {
      $state.go('search');
    }

    // List of background classes
    // See /public/modules/core/less/board.less for more
    $scope.bgs = [
      'board-sierranevada',
      'board-hitchroad',
    ];

  }
]);
