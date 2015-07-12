(function() {
  'use strict';

  angular
    .module('core')
    .factory('Languages', LanguagesFactory);

  /* @ngInject */
  function LanguagesFactory($window) {

    var service = {
      get: get
    };

    return service;

    function get(type) {
      if (type === 'array') {
        var langsArr = [];
        for (var key in $window.languages) {
          langsArr[langsArr.length] = {key: key, name: $window.languages[key]};
        }
        return langsArr;
      }

      // type === 'object':
      return $window.languages;
    }

    return service;

  }

})();
