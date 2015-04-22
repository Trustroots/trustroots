'use strict';

angular.module('core').factory('Languages', ['$window',
  function($window) {
    var service = {};

    service.get = function (type) {
      if (type === 'array'){
        var langs_arr = [];
        for (var key in $window.languages) {
          langs_arr[langs_arr.length] = {key: key, name: $window.languages[key]};
        }
        return langs_arr;
      } else if (type === 'object'){
        return $window.languages;
      }
    };

    return service;
  }
]);
