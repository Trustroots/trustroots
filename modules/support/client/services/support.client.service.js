(function () {
  // Support service used for communicating with the support REST endpoints

  angular
    .module('support')
    .factory('SupportService', SupportService);

  /* @ngInject */
  function SupportService($resource) {
    return $resource('/api/support');
  }
}());
