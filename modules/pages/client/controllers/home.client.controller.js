'use strict';

angular.module('pages').controller('HomeController', ['$scope', '$state', '$window', 'Authentication', 'SettingsFactory',
  function($scope, $state, $window, Authentication, SettingsFactory) {

    // Redirect logged-in users out from front page
    if( Authentication.user ) {
      $state.go('search');
    }

    var settings = SettingsFactory.get();
    $scope.tagline = settings.tagline;

    // List of background classes
    // See /public/modules/core/less/board.less for more
    $scope.bgs = [
      'board-sierranevada',
      'board-hitchroad',
    ];

  }
]);
