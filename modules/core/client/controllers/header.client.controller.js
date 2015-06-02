'use strict';

/* This declares to JSHint that 'ga' is a global variable: */
/*global ga:false */

angular.module('core').controller('HeaderController', ['$scope', '$filter', '$state', 'Authentication', 'SettingsFactory',
  function($scope, $filter, $state, Authentication, SettingsFactory) {

    $scope.user = Authentication.user;
    $scope.appSettings = SettingsFactory.get();
    $scope.isCollapsed = false;
    $scope.isHidden = false;

    $scope.toggleCollapsibleMenu = function() {
      $scope.isCollapsed = !$scope.isCollapsed;
    };

    // Perform actions at page change
    $scope.$on('$stateChangeSuccess', function(event, toState, toParams, fromState, fromParams) {

      // Collapsing the menu after navigation
      $scope.isCollapsed = false;

      // Hide header at certain pages
      $scope.isHidden = (['home', 'signup', 'signin'].indexOf(toState.name) > -1) ? true : false;

      if(!$scope.user && Authentication.user) {
        $scope.user = Authentication.user;
      }

    });

  }
]);
