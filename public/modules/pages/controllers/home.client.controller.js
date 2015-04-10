'use strict';


angular.module('pages').controller('HomeController', ['$scope', '$state', '$window', 'Authentication',
  function($scope, $state, $window, Authentication) {

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

    // This comes from configs
    $scope.description = $window.settings.description;

  }
]);
