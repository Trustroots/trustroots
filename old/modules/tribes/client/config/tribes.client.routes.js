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
      url: '/:circle',
      footerHidden: true,
      templateUrl: showTemplateUrl,
      controller: 'TribeController',
      controllerAs: 'tribeCtrl',
      resolve: {
        // A string value resolves to a service
        TribeService: 'TribeService',
        tribe(TribeService, $stateParams) {
          return TribeService.get({
            tribeSlug: $stateParams.circle,
          });
        },
      },
      data: {
        pageTitle: 'Circle',
      },
    });
}
