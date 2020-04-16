import navigationTemplateUrl from '@/modules/pages/client/views/navigation.client.view.html';
import rulesTemplateUrl from '@/modules/pages/client/views/rules.client.view.html';
import teamTemplateUrl from '@/modules/pages/client/views/team.client.view.html';
import privacyTemplateUrl from '@/modules/pages/client/views/privacy.client.view.html';
import donateTemplateUrl from '@/modules/pages/client/views/donate.client.view.html';
import donateHelpTemplateUrl from '@/modules/pages/client/views/donate-help.client.view.html';
import donatePolicyTemplateUrl from '@/modules/pages/client/views/donate-policy.client.view.html';
// import foundationTemplateUrl from '@/modules/pages/client/views/foundation.client.view.html';
import mediaTemplateUrl from '@/modules/pages/client/views/media.client.view.html';
import guideTemplateUrl from '@/modules/pages/client/views/guide.client.view.html';
// import homeTemplateUrl from '@/modules/pages/client/views/home.client.view.html';

angular.module('pages').config(PagesRoutes);

/* @ngInject */
function PagesRoutes($stateProvider) {
  // Remember to update `./public/sitemap.xml`

  $stateProvider
    .state('navigation', {
      url: '/navigation',
      templateUrl: navigationTemplateUrl,
      requiresAuth: true,
      footerHidden: true,
      data: {
        pageTitle: 'Navigation',
      },
    })
    .state('rules', {
      url: '/rules',
      templateUrl: rulesTemplateUrl,
      data: {
        pageTitle: 'Rules',
      },
    })
    .state('team', {
      url: '/team',
      templateUrl: teamTemplateUrl,
      data: {
        pageTitle: 'Team',
      },
    })
    .state('privacy', {
      url: '/privacy',
      templateUrl: privacyTemplateUrl,
      data: {
        pageTitle: 'Privacy policy',
      },
    })
    .state('donate', {
      url: '/donate',
      templateUrl: donateTemplateUrl,
      data: {
        pageTitle: 'Donate',
      },
    })
    .state('donate-help', {
      url: '/donate/help',
      templateUrl: donateHelpTemplateUrl,
      data: {
        pageTitle: 'Donation help',
      },
    })
    .state('donate-policy', {
      url: '/donate/policy',
      templateUrl: donatePolicyTemplateUrl,
      data: {
        pageTitle: 'Donation policy',
      },
    })
    .state('faq', {
      url: '/faq',
      abstract: true,
      // template: '<faq></faq>', // TODO remove after implementing FAQ pages
      // controller: 'FaqController', // ANGULAR
      // controllerAs: 'faq', // ANGULAR
      // data: {
      //   pageTitle: 'FAQ',
      // },
    })
    .state('faq.general', {
      url: '',
      template: `
        <FaqGeneral
          user="app.user"
          invitationsEnabled="app.appSettings.invitationsEnabled"
        />`,
      data: {
        pageTitle: 'FAQ - Site & community',
      },
    })
    .state('faq.tribes', {
      url: '/tribes',
      template: `
        <FaqTribes
          invitationsEnabled="app.appSettings.invitationsEnabled"
        />`,
      data: {
        pageTitle: 'FAQ - Tribes',
      },
    })
    .state('faq.foundation', {
      url: '/foundation',
      template: `
        <FaqFoundation
          invitationsEnabled="app.appSettings.invitationsEnabled"
        />`,
      data: {
        pageTitle: 'FAQ - Foundation',
      },
    })
    .state('faq.technology', {
      url: '/technology',
      template: `
        <FaqTechnology
          invitationsEnabled="app.appSettings.invitationsEnabled"
        />`,
      data: {
        pageTitle: 'FAQ - Technology',
      },
    })
    .state('foundation', {
      url: '/foundation',
      template: '<foundation></foundation>',
      data: {
        pageTitle: 'Foundation',
      },
    })
    .state('media', {
      url: '/media',
      templateUrl: mediaTemplateUrl,
      data: {
        pageTitle: 'Media',
      },
    })
    .state('volunteering', {
      url: '/volunteering',
      template: '<volunteering></volunteering>',
      data: {
        pageTitle: 'Volunteering',
      },
    })
    .state('guide', {
      url: '/guide',
      templateUrl: guideTemplateUrl,
      data: {
        pageTitle: 'Guide',
      },
    })
    .state('about', {
      url: '/about',
      footerHidden: true,
      controller:
        /* @ngInject */
        function ($state) {
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
      url: '/?tribe',
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
