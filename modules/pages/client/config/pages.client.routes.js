angular.module('pages').config(PagesRoutes);

/* @ngInject */
function PagesRoutes($stateProvider) {
  // Remember to update `./public/sitemap.xml`

  $stateProvider
    .state('navigation', {
      url: '/navigation',
      template: `
        <navigation
          user="app.user"
          isNativeMobileApp="app.isNativeMobileApp"
          onSignout="app.signout"
        />`,
      requiresAuth: true,
      footerHidden: true,
      data: {
        pageTitle: 'Navigation',
      },
    })
    .state('rules', {
      url: '/rules',
      template: '<rules />',
      data: {
        pageTitle: 'Rules',
      },
    })
    .state('team', {
      url: '/team',
      template: `
        <team
          user="app.user"
        />`,
      data: {
        pageTitle: 'Team',
      },
    })
    .state('privacy', {
      url: '/privacy',
      template: `
        <privacy
          user="app.user"
        />`,
      data: {
        pageTitle: 'Privacy policy',
      },
    })
    .state('contribute', {
      url: '/contribute',
      template: '<contribute />',
      data: {
        pageTitle: 'Contribute',
      },
    })
    .state('faq', {
      url: '/faq',
      abstract: true,
      template: '<ui-view />',
    })
    .state('faq.general', {
      url: '',
      template: `<faq-general />`,
      data: {
        pageTitle: 'FAQ - Site & community',
      },
    })
    .state('faq.circles', {
      url: '/circles',
      template: `<faq-tribes />`,
      data: {
        pageTitle: 'FAQ - Circles',
      },
    })
    .state('faq.foundation', {
      url: '/foundation',
      template: `<faq-foundation />`,
      data: {
        pageTitle: 'FAQ - Foundation',
      },
    })
    .state('faq.technology', {
      url: '/technology',
      template: `<faq-technology />`,
      data: {
        pageTitle: 'FAQ - Technology',
      },
    })
    .state('foundation', {
      url: '/foundation',
      template: `
        <foundation
          user="app.user"
        />`,
      data: {
        pageTitle: 'Foundation',
      },
    })
    .state('media', {
      url: '/media',
      template: '<media />',
      data: {
        pageTitle: 'Media',
      },
    })
    .state('volunteering', {
      url: '/volunteering',
      template: '<volunteering />',
      data: {
        pageTitle: 'Volunteering',
      },
    })
    .state('guide', {
      url: '/guide',
      template: '<guide />',
      data: {
        pageTitle: 'Guide',
      },
    })
    .state('about', {
      url: '/about',
      footerHidden: true,
      /* @ngInject */
      controller($state) {
        $state.go('home');
      },
      controllerAs: 'about',
    });

  /**
   * Work around redirecting to home on SEO rendered pages
   */
  // Angular's `$window` service is not available for `config` blocks
  // eslint-disable-next-line angular/window-service
  if (window.location.search.search('_escaped_fragment_') === -1) {
    $stateProvider.state('home', {
      url: '/?tribe?circle',
      template: `
        <home
          user="app.user"
          isNativeMobileApp="app.isNativeMobileApp"
          photoCredits="app.photoCredits"
        />`,
      footerHidden: true,
    });
  } else {
    $stateProvider.state('home', { url: '/' });
  }
}
