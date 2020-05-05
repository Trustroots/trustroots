import templateUrl from '@/modules/statistics/client/views/statistics.client.view.html';

angular.module('statistics').config(StatisticsRoutes);

/* @ngInject */
function StatisticsRoutes($stateProvider) {
  $stateProvider.state('statistics', {
    url: '/statistics',
    templateUrl,
    controller: 'StatisticsController',
    controllerAs: 'stats',
    footerHidden: false,
    resolve: {
      // A string value resolves to a service
      SettingsService: 'Statistics',
      statisticsData: function (Statistics) {
        return Statistics.get();
      },
    },
    data: {
      pageTitle: 'Statistics',
    },
  });
}
