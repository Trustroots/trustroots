(function(){
  'use strict';

  /*
   * Application wide view controller
   */
  angular.module('core').controller('AppController', ['$scope', '$rootScope', '$window', '$state', 'Authentication', 'messageCenterService', 'SettingsFactory',
    function($scope, $rootScope, $window, $state, Authentication, messageCenterService, SettingsFactory) {

      // ViewModel
      var vm = this;

      // Exposed
      vm.user = Authentication.user;
      vm.appSettings = SettingsFactory.get();
      vm.goHome = goHome;

      // Used as a cache buster with ng-include
      // Includes a hash of latest git commit
      vm.cacheBust = vm.appSettings.commit || '';

      /**
       * Determine where to direct user from "home" links
       */
      function goHome() {
        if(Authentication.user) {
          $state.go('search');
        }
        else {
          $state.go('home');
        }
      }

      // Receive user changes
      $scope.$on('userUpdated', function(){
        vm.user = Authentication.user;
      });

      // Before page change
      $scope.$on('$stateChangeStart', function(event, toState, toParams, fromState, fromParams) {

        // Redirect to login page if no user
        if (toState.requiresAuth && !Authentication.user) {
          // Cancel stateChange
          event.preventDefault();

          // Save previous state
          // See modules/users/client/controllers/authentication.client.controller.js for how they're used
          $rootScope.signinState = toState.name;
          $rootScope.signinStateParams = toParams;
          $state.go('signin-continue', {'continue': true});
        }

      });

      // After page change
      $scope.$on('$stateChangeSuccess', function(event, toState, toParams, fromState, fromParams) {

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

})();
