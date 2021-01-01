angular.module('support').config(SupportRoutes);

/* @ngInject */
function SupportRoutes($stateProvider) {
  $stateProvider
    .state('support', {
      url: '/support?report=',
      template: '<support-page user="app.user"></support-page>',
      requiresAuth: false,
      data: {
        pageTitle: 'Support',
      },
    })
    // Deprecated (02-2016):
    .state('contact', {
      url: '/contact',
      template: '<support-page user="app.user"></support-page>',
      requiresAuth: false,
      data: {
        pageTitle: 'Contact us',
      },
    });
}
