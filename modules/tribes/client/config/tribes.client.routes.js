import showTemplateUrl from '@/modules/tribes/client/views/tribe.client.view.html';

angular.module('tribes').config(TribesRoutes);

/* @ngInject */
function TribesRoutes($stateProvider) {
  $stateProvider
    .state('circles', {
      url: '/circles',
      abstract: true,
      template: '<ui-view/>',
    })
    .state('circles.list', {
      url: '',
      template: `
        <tribes-page
          user="app.user"
          onMembershipUpdated="tribesList.broadcastUpdatedUser"
        ></tribes-page>
      `,
      controller: 'TribesListController',
      controllerAs: 'tribesList',
      data: {
        pageTitle: 'Circles',
      },
    })
    .state('circles.circle', {
      url: '/:tribe',
      footerHidden: true,
      templateUrl: showTemplateUrl,
      controller: 'TribeController',
      controllerAs: 'tribeCtrl',
      resolve: {
        // A string value resolves to a service
        TribeService: 'TribeService',
        tribe: function (TribeService, $stateParams) {
          return TribeService.get({
            tribeSlug: $stateParams.tribe,
          });
        },
      },
      data: {
        pageTitle: 'Circle',
      },
    });

  // Deprecated June 2020
  $stateProvider
    .state('tribes', {
      url: '/tribes',
      abstract: true,
    })
    .state('tribes', {
      url: '/tribes',
      controller:
        /* @ngInject */
        function ($state) {
          $state.go('circles');
        },
      controllerAs: 'circles',
      requiresAuth: false,
      data: {
        pageTitle: 'Circles',
      },
    })
    .state('tribes.tribe', {
      url: '/:tribe',
      controller:
        /* @ngInject */
        function ($state, $stateParams) {
          $state.go('circles.circle', $stateParams);
        },
      controllerAs: 'circle',
      requiresAuth: false,
      data: {
        pageTitle: 'Circle',
      },
    });
}
