(function () {
  angular
    .module('support')
    .config(SupportRoutes);

  /* @ngInject */
  function SupportRoutes($stateProvider) {

    $stateProvider.
      state('support', {
        url: '/support?report=',
        templateUrl: '/modules/support/views/support.client.view.html',
        requiresAuth: false,
        controller: 'SupportController',
        controllerAs: 'support',
        data: {
          pageTitle: 'Support'
        }
      }).
      // Deprecated (02-2016):
      state('contact', {
        url: '/contact',
        templateUrl: '/modules/support/views/support.client.view.html',
        requiresAuth: false,
        controller: 'SupportController',
        controllerAs: 'support',
        data: {
          pageTitle: 'Contact us'
        }
      });
  }
}());
