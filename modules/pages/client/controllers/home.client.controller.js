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
    // See /modules/core/client/less/board.less for more
    // Needs to support container-full and board-blur classes.
    // First array has background(s) for small screens, the second for bigger screens
    // Small = (@screen-xs-max - 1px)
    $scope.bgs = ($window.innerWidth < 767) ? ['board-forestpath'] : ['board-sierranevada', 'board-hitchroad'];
  }
]);
