(function () {
  angular
    .module('pages')
    .config(PagesRoutes);

  /* @ngInject */
  function PagesRoutes($stateProvider) {

    // Remember to update `./public/sitemap.xml`

    $stateProvider.
      state('navigation', {
        url: '/navigation',
        templateUrl: '/modules/pages/views/navigation.client.view.html',
        requiresAuth: true,
        footerHidden: true,
        data: {
          pageTitle: 'Navigation'
        }
      }).
      state('rules', {
        url: '/rules',
        templateUrl: '/modules/pages/views/rules.client.view.html',
        data: {
          pageTitle: 'Rules'
        }
      }).
      state('team', {
        url: '/team',
        templateUrl: '/modules/pages/views/team.client.view.html',
        data: {
          pageTitle: 'Team'
        }
      }).
      state('privacy', {
        url: '/privacy',
        templateUrl: '/modules/pages/views/privacy.client.view.html',
        data: {
          pageTitle: 'Privacy policy'
        }
      }).
      state('donate', {
        url: '/donate',
        templateUrl: '/modules/pages/views/donate.client.view.html',
        data: {
          pageTitle: 'Donate'
        }
      }).
      state('donate-help', {
        url: '/donate/help',
        templateUrl: '/modules/pages/views/donate-help.client.view.html',
        data: {
          pageTitle: 'Donation help'
        }
      }).
      state('donate-policy', {
        url: '/donate/policy',
        templateUrl: '/modules/pages/views/donate-policy.client.view.html',
        data: {
          pageTitle: 'Donation policy'
        }
      }).
      state('faq', {
        url: '/faq',
        templateUrl: '/modules/pages/views/faq.client.view.html',
        abstract: true,
        controller: 'FaqController',
        controllerAs: 'faq',
        data: {
          pageTitle: 'FAQ'
        }
      }).
      state('faq.general', {
        url: '',
        templateUrl: '/modules/pages/views/faq-general.client.view.html',
        data: {
          pageTitle: 'FAQ - Site & community'
        }
      }).
      state('faq.tribes', {
        url: '/tribes',
        templateUrl: '/modules/pages/views/faq-tribes.client.view.html',
        data: {
          pageTitle: 'FAQ - Tribes'
        }
      }).
      state('faq.foundation', {
        url: '/foundation',
        templateUrl: '/modules/pages/views/faq-foundation.client.view.html',
        data: {
          pageTitle: 'FAQ - Foundation'
        }
      }).
      state('faq.technology', {
        url: '/technology',
        templateUrl: '/modules/pages/views/faq-technology.client.view.html',
        data: {
          pageTitle: 'FAQ - Technology'
        }
      }).
      state('foundation', {
        url: '/foundation',
        templateUrl: '/modules/pages/views/foundation.client.view.html',
        data: {
          pageTitle: 'Foundation'
        }
      }).
      state('media', {
        url: '/media',
        templateUrl: '/modules/pages/views/media.client.view.html',
        data: {
          pageTitle: 'Media'
        }
      }).
      state('volunteering', {
        url: '/volunteering',
        template: '<volunteering></volunteering>',
        data: {
          pageTitle: 'Volunteering'
        }
      }).
      state('guide', {
        url: '/guide',
        templateUrl: '/modules/pages/views/guide.client.view.html',
        data: {
          pageTitle: 'Guide'
        }
      }).

      // Redirect to home:
      state('about', {
        url: '/about',
        footerHidden: true,
        controller:
          /* @ngInject */
          function ($state) {
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
