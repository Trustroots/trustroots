(function() {
  'use strict';

  angular
    .module('pages')
    .config(PagesRoutes);

  /* @ngInject */
  function PagesRoutes($stateProvider, $urlRouterProvider) {

    $stateProvider.
      state('rules', {
        url: '/rules',
        templateUrl: 'modules/pages/views/rules.client.view.html'
      }).
      state('team', {
        url: '/team',
        templateUrl: 'modules/pages/views/team.client.view.html'
      }).
      state('contact', {
        url: '/contact',
        templateUrl: 'modules/pages/views/contact.client.view.html',
        controller: 'ContactController',
        controllerAs: 'contact'
      }).
      state('about', {
        url: '/about',
        templateUrl: 'modules/pages/views/about.client.view.html'
      }).
      state('privacy', {
        url: '/privacy',
        templateUrl: 'modules/pages/views/privacy.client.view.html'
      }).
      state('donate', {
        url: '/donate',
        templateUrl: 'modules/pages/views/donate.client.view.html'
      }).
      state('donate-help', {
        url: '/donate/help',
        templateUrl: 'modules/pages/views/donate-help.client.view.html'
      }).
      state('donate-policy', {
        url: '/donate/policy',
        templateUrl: 'modules/pages/views/donate-policy.client.view.html'
      }).
      state('faq', {
        url: '/faq',
        templateUrl: 'modules/pages/views/faq.client.view.html',
        controller: 'FaqController',
        controllerAs: 'faq',
      }).
      state('foundation', {
        url: '/foundation',
        templateUrl: 'modules/pages/views/foundation.client.view.html'
      }).
      state('media', {
        url: '/media',
        templateUrl: 'modules/pages/views/media.client.view.html'
      }).
      state('home', {
        url: '/',
        templateUrl: 'modules/pages/views/home.client.view.html',
        footerTransparent: true,
        headerHidden: true
      });
  }

})();
