'use strict';

/* This declares to JSHint that 'ga' is a global variable: */
/*global ga:false */

angular.module('core').controller('HeaderController', ['$scope', '$filter', '$state', 'Authentication',
  function($scope, $filter, $state, Authentication) {

    $scope.user = Authentication.user;
    $scope.isCollapsed = false;
    $scope.isHidden = false;

    $scope.toggleCollapsibleMenu = function() {
      $scope.isCollapsed = !$scope.isCollapsed;
    };

    $scope.goHome = function() {
      if(Authentication.user) {
        $state.go('search');
      }
      else {
        $state.go('home');
      }
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
