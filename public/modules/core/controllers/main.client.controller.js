'use strict';

/* This declares to JSHint that 'ga' is a global variable: */
/*global ga:false */

angular.module('core').controller('MainController', ['$scope', '$rootScope', '$window', '$state', '$location', 'Authentication', 'messageCenterService', //'Socket',
  function($scope, $rootScope, $window, $state, $location, Authentication, messageCenterService) { //Socket

    /*
    Socket.on('reconnect', function () {
      messageCenterService.add('success', 'Reconnected to the server.', { timeout: 2500 });
    });

    Socket.on('reconnecting', function () {
      messageCenterService.add('warning', 'Attempting to re-connect to the server.', { timeout: 2500 });
    });
    */

    // Perform actions at page change
    $scope.$on('$stateChangeSuccess', function(event, toState, toParams, fromState, fromParams) {

      // Reset page scroll on page change
      $window.scrollTo(0,0);

      // Analytics
      if (typeof(ga) === 'function') {
        ga('send', 'pageview', {
          'page': '/#!' + toState.url,
          //'title': ''
        });
      }

      // These pages require authenticated user
      var authRequiredPages = ['welcome',
                               'profile-edit',
                               'profile-settings',
                               'confirm-email',
                               'profile-tab',
                               'profile-updated',
                               'search',
                               'contactAdd',
                               'contactConfirm',
                               'offer',
                               'offer-status',
                               'listMessages',
                               'inboxMessages',
                              ];

      // Redirect to login page if no user
      if (authRequiredPages.indexOf(toState.name) > -1 && !Authentication.user) {
        // Save previous state
        // See public/modules/users/controllers/authentication.client.controller.js for how they're used
        $rootScope.signinState = toState.name;
        $rootScope.signinStateParams = toParams;
        $state.go('signin-continue', {'continue': true});
      }

    });


  }
]);
