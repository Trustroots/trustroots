import searchTemplateUrl from '@/modules/search/client/views/search.client.view.html';
import searchMapTemplateUrl from '@/modules/search/client/views/search-map.client.view.html';
import searchSidebarTemplateUrl from '@/modules/search/client/views/search-sidebar.client.view.html';

angular.module('search').config(SearchRoutes);
/* @ngInject */
function SearchRoutes($stateProvider) {
  $stateProvider
    .state('search', {
      url: '/search?' + ['location', 'offer', 'tribe'].join('?'),
      templateUrl: searchTemplateUrl,
      abstract: true,
      requiresAuth: true,
      footerHidden: true,
      controller: 'SearchController',
      controllerAs: 'search',
      resolve: {
        // A string value resolves to a service
        OffersService: 'OffersService',
        offer($stateParams, OffersService) {
          if ($stateParams.offer && $stateParams.offer.length === 24) {
            return OffersService.get({
              offerId: $stateParams.offer,
            });
          } else {
            return false;
          }
        },

        // A string value resolves to a service
        TribeService: 'TribeService',
        tribe(TribeService, $stateParams) {
          if ($stateParams.tribe && $stateParams.tribe.length) {
            return TribeService.get({
              tribeSlug: $stateParams.tribe,
            });
          } else {
            return false;
          }
        },
      },
      data: {
        pageTitle: 'Search',
      },
    })
    .state('search.map', {
      url: '',
      requiresAuth: true,
      footerHidden: true,
      data: {
        pageTitle: 'Search',
      },
      views: {
        map: {
          templateUrl: searchMapTemplateUrl,
          controller: 'SearchMapController',
          controllerAs: 'searchMap',
        },
        sidebar: {
          templateUrl: searchSidebarTemplateUrl,
        },
      },
    })
    .state('search-users', {
      url: '/search/members',
      template: '<search-users />',
      requiresAuth: true,
      footerHidden: true,
      data: {
        pageTitle: 'Search members',
      },
    });
}
