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
        title: 'Rules',
        templateUrl: 'modules/pages/views/rules.client.view.html'
      }).
      state('team', {
        url: '/team',
        title: 'Team',
        templateUrl: 'modules/pages/views/team.client.view.html'
      }).
      state('about', {
        url: '/about',
        title: 'About',
        templateUrl: 'modules/pages/views/about.client.view.html'
      }).
      state('privacy', {
        url: '/privacy',
        title: 'Privacy policy',
        templateUrl: 'modules/pages/views/privacy.client.view.html'
      }).
      state('donate', {
        url: '/donate',
        title: 'Donate',
        templateUrl: 'modules/pages/views/donate.client.view.html'
      }).
      state('donate-help', {
        url: '/donate/help',
        title: 'Donation help',
        templateUrl: 'modules/pages/views/donate-help.client.view.html'
      }).
      state('donate-policy', {
        url: '/donate/policy',
        title: 'Donation policy',
        templateUrl: 'modules/pages/views/donate-policy.client.view.html'
      }).
      state('faq', {
        url: '/faq',
        title: 'FAQ',
        templateUrl: 'modules/pages/views/faq.client.view.html',
        controller: 'FaqController',
        controllerAs: 'faq',
      }).
      state('foundation', {
        url: '/foundation',
        title: 'Foundation',
        templateUrl: 'modules/pages/views/foundation.client.view.html'
      }).
      state('media', {
        url: '/media',
        title: 'Media',
        templateUrl: 'modules/pages/views/media.client.view.html'
      }).
      state('volunteering', {
        url: '/volunteering',
        title: 'Volunteering',
        templateUrl: 'modules/pages/views/volunteering.client.view.html'
      });

      /**
       * Work around redirecting to home on SEO rendered pages
       */
      if (window.location.search.search('_escaped_fragment_') === -1) {
        $stateProvider.state('home', {
          url: '/',
          templateUrl: 'modules/pages/views/home.client.view.html',
          controller: 'HomeController',
          controllerAs: 'home',
          footerHidden: true
        });
      } else {
        $stateProvider.state('home', {url: '/'});
      }

  }

})();
