import searchTemplate from '@/modules/search/client/views/search.client.view.html';
import searchMapTemplate from '@/modules/search/client/views/search-map.client.view.html';
import searchSidebarTemplate from '@/modules/search/client/views/search-sidebar.client.view.html';
import searchSigninTemplate from '@/modules/search/client/views/search-signin.client.view.html';

(function () {
  angular
    .module('search')
    .config(SearchRoutes);
  // eslint-disable-next-line no-console
  console.log('templateUrl is', searchTemplate);
  /* @ngInject */
  function SearchRoutes($stateProvider) {

    $stateProvider.
      state('search', {
        url: '/search?' + [
          'location',
          'offer',
          'tribe'
        ].join('?'),
        templateUrl: searchTemplate,
        abstract: true,
        requiresAuth: true,
        footerHidden: true,
        controller: 'SearchController',
        controllerAs: 'search',
        resolve: {

          // A string value resolves to a service
          OffersService: 'OffersService',
          offer: function ($stateParams, OffersService) {
            if ($stateParams.offer && $stateParams.offer.length === 24) {
              return OffersService.get({
                offerId: $stateParams.offer
              });
            } else {
              return false;
            }
          },

          // A string value resolves to a service
          TribeService: 'TribeService',
          tribe: function (TribeService, $stateParams) {
            if ($stateParams.tribe && $stateParams.tribe.length) {
              return TribeService.get({
                tribeSlug: $stateParams.tribe
              });
            } else {
              return false;
            }
          }

        },
        data: {
          pageTitle: 'Search'
        }
      }).
      state('search.map', {
        url: '',
        requiresAuth: true,
        footerHidden: true,
        data: {
          pageTitle: 'Search'
        },
        views: {
          'map': {
            templateUrl: searchMapTemplate,
            controller: 'SearchMapController',
            controllerAs: 'searchMap'
          },
          'sidebar': {
            templateUrl: searchSidebarTemplate
          }
        }
      }).
      state('search-signin', {
        url: '/search?location?offer?tribe',
        templateUrl: searchSigninTemplate,
        requiresAuth: false,
        footerHidden: true,
        controller: 'SearchSignupController',
        controllerAs: 'searchSignup',
        data: {
          pageTitle: 'Search'
        }
      }).
      state('search-users', {
        url: '/search/members',
        template: '<search-users />',
        requiresAuth: true,
        footerHidden: true,
        data: {
          pageTitle: 'Search members'
        }
      });
  }
}());
