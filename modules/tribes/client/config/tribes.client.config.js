import listTemplateUrl from '@/modules/tribes/client/views/tribes-list.client.view.html';
import showTemplateUrl from '@/modules/tribes/client/views/tribe.client.view.html';

angular
  .module('tribes')
  .config(TribesRoutes);

/* @ngInject */
function TribesRoutes($stateProvider) {

  $stateProvider.
    state('tribes', {
      url: '/tribes',
      abstract: true,
      template: '<ui-view/>',
    }).
    state('tribes.list', {
      url: '',
      templateUrl: listTemplateUrl,
      controller: 'TribesListController',
      controllerAs: 'tribesList',
      data: {
        pageTitle: 'Tribes',
      },
    }).
    state('tribes.tribe', {
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
        pageTitle: 'Tribe',
      },
    });

}
