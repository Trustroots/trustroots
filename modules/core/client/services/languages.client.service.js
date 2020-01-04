(function () {
  angular
    .module('core')
    .factory('Languages', LanguagesFactory);

  /* @ngInject */
  function LanguagesFactory($window) {

    const service = {
      get: get,
    };

    return service;

    function get(type) {
      if (type === 'array') {
        const langsArr = [];

        angular.forEach($window.languages, function (value, key) {
          this.push({ key: key, name: value });
        }, langsArr);

        return langsArr;
      }

      // type === 'object':
      return $window.languages;
    }

  }
}());
