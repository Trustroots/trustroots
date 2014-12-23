'use strict';

// statistics service used for communicating with the statistics REST endpoints

angular.module('statistics').factory('Statistics', ['$resource',
  function($resource) {
    return $resource('statistics');
  }
]);
