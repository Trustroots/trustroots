(function() {
  'use strict';

  angular
    .module('tags')
    .config(TagsRoutes);

  /* @ngInject */
  function TagsRoutes($stateProvider) {

    $stateProvider.
      state('tribes', {
        url: '/tribes',
        abstract: true,
        template: '<ui-view/>'
      }).
        state('tribes.list', {
          url: '',
          title: 'Tribes',
          templateUrl: '/modules/tags/views/tribes-list.client.view.html',
          controller: 'TribesListController',
          controllerAs: 'tribesList',
          resolve: {
            // A string value resolves to a service
            TribesService: 'TribesService',
            tribes: function(TribesService) {
              return TribesService.query();
            }
          }
        }).
        state('tribes.tribe', {
          url: '/:tribe',
          title: 'Tribe',
          footerHidden: true,
          templateUrl: '/modules/tags/views/tribe.client.view.html',
          controller: 'TribeController',
          controllerAs: 'tribeCtrl',
          resolve: {
            // A string value resolves to a service
            TribeService: 'TribeService',
            tribe: function(TribeService, $stateParams) {
              return TribeService.get({
                tribeSlug: $stateParams.tribe
              });
            }
          }
        });

  }

})();
