(function() {
  'use strict';

  angular
    .module('statistics')
    .config(StatisticsRoutes);

  /* @ngInject */
  function StatisticsRoutes($stateProvider) {

    $stateProvider.
      state('statistics', {
        url: '/statistics',
        templateUrl: 'modules/statistics/views/statistics.client.view.html',
        controller: 'StatisticsController',
        controllerAs: 'stats',
        resolve: {
          // A string value resolves to a service
          SettingsService: 'Statistics',
          data: function(Statistics) {
            return Statistics.get();
          }
        }
      });

  }

})();
