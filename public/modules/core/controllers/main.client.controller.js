'use strict';

/* This declares to JSHint that 'ga' is a global variable: */
/*global ga:false */

angular.module('core').controller('MainController', ['$scope', 'Socket', 'messageCenterService',
  function($scope, Socket, messageCenterService) {

    Socket.on('reconnect', function () {
      messageCenterService.add('success', 'Reconnected to the server.', { timeout: 2500 });
    });

    Socket.on('reconnecting', function () {
      messageCenterService.add('warning', 'Attempting to re-connect to the server.', { timeout: 2500 });
    });

  }
]);
