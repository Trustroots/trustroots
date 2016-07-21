(function () {
  'use strict';

  angular
    .module('tags')
    .factory('TribesService', TribesService);

  /* @ngInject */
  function TribesService($resource) {
    return $resource('/api/tribes', {}, {
      'query': { method: 'GET', isArray: true }
    });
  }

}());
