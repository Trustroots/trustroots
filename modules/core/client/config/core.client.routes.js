(function() {
  'use strict';

  angular
    .module('core')
    .config(CoreRoutes);

  /* @ngInject */
  function CoreRoutes($stateProvider, $urlRouterProvider) {

    // Redirect to 404 when route not found
    $urlRouterProvider.otherwise('not-found');

    // Home state routing
    $stateProvider.
      state('not-found', {
        url: '/not-found',
        templateUrl: 'modules/core/views/404.client.view.html',
        footerHidden: true,
        headerHidden: true
      });
  }

})();
