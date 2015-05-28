'use strict';

angular.module('core').controller('MainController', ['$scope', '$rootScope', '$window', '$state', '$location', 'Authentication', 'messageCenterService', 'SettingsFactory', //'Socket',
  function($scope, $rootScope, $window, $state, $location, Authentication, messageCenterService, SettingsFactory) { //Socket

    /*
    Socket.on('reconnect', function () {
      messageCenterService.add('success', 'Reconnected to the server.', { timeout: 2500 });
    });

    Socket.on('reconnecting', function () {
      messageCenterService.add('warning', 'Attempting to re-connect to the server.', { timeout: 2500 });
    });
    */

    $scope.appSettings = SettingsFactory.get();

    // This is used as a cache buster with ng-include
    // Includes a hash of latest git commit
    $scope.cacheBust = $scope.appSettings.commit || '';

    $scope.goHome = function() {
      if(Authentication.user) {
        $state.go('search');
      }
      else {
        $state.go('home');
      }
    };

    // Perform actions at page change
    $rootScope.$on('$stateChangeStart', function(event, toState, toParams, fromState, fromParams) {

      // Redirect to login page if no user
      if (toState.requiresAuth && !Authentication.user) {
        // Cancel stateChange
        event.preventDefault();

        // Save previous state
        // See public/modules/users/controllers/authentication.client.controller.js for how they're used
        $rootScope.signinState = toState.name;
        $rootScope.signinStateParams = toParams;
        $state.go('signin-continue', {'continue': true});
      }

    });

    $rootScope.$on('$stateChangeSuccess', function(event, toState, toParams, fromState, fromParams) {

      // Reset page scroll on page change
      $window.scrollTo(0,0);

      // Analytics
      if (typeof(ga) === 'function') {
        ga('send', 'pageview', {
          'page': toState.url,
          //'title': ''
        });
      }

    });

  }
]);
