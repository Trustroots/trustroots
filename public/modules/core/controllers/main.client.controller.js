'use strict';

/* This declares to JSHint that 'ga' is a global variable: */
/*global ga:false */

angular.module('core').controller('MainController', ['$scope', '$window', 'messageCenterService', //'Socket',
  function($scope, $window, messageCenterService) { //Socket

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

    });


  }
]);
