import showTemplateUrl from '@/modules/tribes/client/views/tribe.client.view.html';

angular.module('tribes').config(TribesRoutes);

function resolveCircle(TribeService, $stateParams) {
  return TribeService.get({
    tribeSlug: $stateParams.circle,
  });
}
resolveCircle.$inject = ['TribeService', '$stateParams'];

function requiresCircleAuthentication(params) {
  return params.circle === 'naturists';
}

function circleDetailState(url, requiresAuth, resolveTribe, requiresAuthFor) {
  return {
    url,
    requiresAuth,
    requiresAuthFor,
    footerHidden: true,
    templateUrl: showTemplateUrl,
    controller: 'TribeController',
    controllerAs: 'tribeCtrl',
    resolve: {
      // A string value resolves to a service
      TribeService: 'TribeService',
      tribe: resolveTribe,
    },
    data: {
      pageTitle: 'Circle',
    },
  };
}

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
    .state(
      'circles.circle',
      circleDetailState(
        '/:circle',
        false,
        resolveCircle,
        requiresCircleAuthentication,
      ),
    );
}
