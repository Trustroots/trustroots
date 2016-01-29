(function() {
  'use strict';

  angular
    .module('support')
    .config(SupportRoutes);

  /* @ngInject */
  function SupportRoutes($stateProvider) {

    $stateProvider.
      state('support', {
        url: '/support',
        title: 'Support',
        templateUrl: 'modules/support/views/support.client.view.html',
        requiresAuth: false,
        controller: 'SupportController',
        controllerAs: 'support'
      }).
      // Deprecated (02-2016):
      state('contact', {
        url: '/contact',
        title: 'Contact us',
        templateUrl: 'modules/support/views/support.client.view.html',
        requiresAuth: false,
        controller: 'SupportController',
        controllerAs: 'support'
      });
  }

})();
