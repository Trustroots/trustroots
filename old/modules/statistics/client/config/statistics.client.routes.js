angular.module('statistics').config(StatisticsRoutes);

/* @ngInject */
function StatisticsRoutes($stateProvider) {
  $stateProvider.state('statistics', {
    url: '/statistics',
    template: '<statistics is-authenticated="!!app.user"></statistics>',
    footerHidden: false,
    data: {
      pageTitle: 'Statistics',
    },
  });
}
