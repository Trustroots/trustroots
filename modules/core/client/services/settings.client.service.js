'use strict';

angular.module('core').factory('SettingsFactory', ['$window',
  function($window) {
    var service = {};

    service.get = function (type) {

      // Settings passed from the backend
      var settings = $window.settings;

      // Additional settings

      // Default timeout for 'message-center' success/alert messages
      settings.flashTimeout = 6000;

      return $window.settings;
    };

    return service;
  }
]);
