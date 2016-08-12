(function () {
  'use strict';

  angular
    .module('pages')
    .config(PagesRoutes);

  /* @ngInject */
  function PagesRoutes($stateProvider) {

    $stateProvider.
      state('rules', {
        url: '/rules',
        title: 'Rules',
        templateUrl: '/modules/pages/views/rules.client.view.html'
      }).
      state('team', {
        url: '/team',
        title: 'Team',
        templateUrl: '/modules/pages/views/team.client.view.html'
      }).
      state('privacy', {
        url: '/privacy',
        title: 'Privacy policy',
        templateUrl: '/modules/pages/views/privacy.client.view.html'
      }).
      state('donate', {
        url: '/donate',
        title: 'Donate',
        templateUrl: '/modules/pages/views/donate.client.view.html'
      }).
      state('donate-help', {
        url: '/donate/help',
        title: 'Donation help',
        templateUrl: '/modules/pages/views/donate-help.client.view.html'
      }).
      state('donate-policy', {
        url: '/donate/policy',
        title: 'Donation policy',
        templateUrl: '/modules/pages/views/donate-policy.client.view.html'
      }).
      state('faq', {
        url: '/faq',
        title: 'FAQ',
        templateUrl: '/modules/pages/views/faq.client.view.html',
        abstract: true,
        controller: 'FaqController',
        controllerAs: 'faq'
      }).
        state('faq.general', {
          url: '',
          title: 'FAQ - Site & community',
          templateUrl: '/modules/pages/views/faq-general.client.view.html'
        }).
        state('faq.tribes', {
          url: '/tribes',
          title: 'FAQ - Tribes',
          templateUrl: '/modules/pages/views/faq-tribes.client.view.html'
        }).
        state('faq.foundation', {
          url: '/foundation',
          title: 'FAQ - Foundation',
          templateUrl: '/modules/pages/views/faq-foundation.client.view.html'
        }).
        state('faq.technology', {
          url: '/technology',
          title: 'FAQ - Technology',
          templateUrl: '/modules/pages/views/faq-technology.client.view.html'
        }).
      state('foundation', {
        url: '/foundation',
        title: 'Foundation',
        templateUrl: '/modules/pages/views/foundation.client.view.html'
      }).
      state('media', {
        url: '/media',
        title: 'Media',
        templateUrl: '/modules/pages/views/media.client.view.html'
      }).
      state('volunteering', {
        url: '/volunteering',
        title: 'Volunteering',
        templateUrl: '/modules/pages/views/volunteering.client.view.html'
      }).
      state('guide', {
        url: '/guide',
        title: 'Guide',
        templateUrl: '/modules/pages/views/guide.client.view.html'
      }).

      // Redirect to home:
      state('about', {
        url: '/about',
        controller:
          /* @ngInject */
          function($state) {
            $state.go('home');
          },
        controllerAs: 'about'
      });

    /**
     * Work around redirecting to home on SEO rendered pages
     */
    // Angular's `$window` service is not available for `config` blocks
    // eslint-disable-next-line angular/window-service
    if (window.location.search.search('_escaped_fragment_') === -1) {
      $stateProvider.state('home', {
        url: '/?tribe',
        templateUrl: '/modules/pages/views/home.client.view.html',
        controller: 'HomeController',
        controllerAs: 'home',
        footerHidden: true
      });
    } else {
      $stateProvider.state('home', { url: '/' });
    }

  }

}());
