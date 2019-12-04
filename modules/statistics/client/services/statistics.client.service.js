(function () {
  // Statistics service used for communicating with the statistics REST endpoints

  angular
    .module('statistics')
    .factory('Statistics', StatisticsService);

  /* @ngInject */
  function StatisticsService($resource) {
    return $resource('/api/statistics');
  }
}());
