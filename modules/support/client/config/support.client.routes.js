import supportTemplateUrl from '@/modules/support/client/views/support.client.view.html';
import contactTemplateUrl from '@/modules/support/client/views/support.client.view.html';

angular.module('support').config(SupportRoutes);

/* @ngInject */
function SupportRoutes($stateProvider) {
  $stateProvider
    .state('support', {
      url: '/support?report=',
      templateUrl: supportTemplateUrl,
      requiresAuth: false,
      controller: 'SupportController',
      controllerAs: 'support',
      data: {
        pageTitle: 'Support',
      },
    })
    // Deprecated (02-2016):
    .state('contact', {
      url: '/contact',
      templateUrl: contactTemplateUrl,
      requiresAuth: false,
      controller: 'SupportController',
      controllerAs: 'support',
      data: {
        pageTitle: 'Contact us',
      },
    });
}
