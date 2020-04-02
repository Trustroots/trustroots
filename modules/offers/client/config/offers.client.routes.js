import viewTemplateUrl from '@/modules/offers/client/views/offer.client.view.html';
import meetListTemplateUrl from '@/modules/offers/client/views/offer-meet-list.client.view.html';
import meetEditTemplateUrl from '@/modules/offers/client/views/offer-meet-edit.client.view.html';

angular.module('offers').config(OffersRoutes);

/* @ngInject */
function OffersRoutes($stateProvider, $urlRouterProvider) {
  // Redirect parent states,
  // otherwise `/offer` would throw 404 because the route is `abstract`
  $urlRouterProvider.when('/offer', '/offer/host');

  $stateProvider
    .state('offer', {
      url: '/offer',
      abstract: true,
      requiresAuth: true,
      templateUrl: viewTemplateUrl,
      controller: 'OfferController',
      controllerAs: 'offer',
      resolve: {
        // A string value resolves to a service
        LocationService: 'LocationService',

        // Initial default location for all offer maps
        defaultLocation: function(LocationService) {
          // Returns `{lat: Float, lng: Float, zoom: 4}`
          return LocationService.getDefaultLocation(4);
        },
      },
    })
    .state('offer.host', {
      url: '/host',
      abstract: true,
      requiresAuth: true,
      template: '<div ui-view></div>',
      controller: 'OfferController',
      controllerAs: 'offer',
      resolve: {
        // A string value resolves to a service
        OffersByService: 'OffersByService',

        offers: function(OffersByService, Authentication) {
          return OffersByService.query({
            userId: Authentication.user._id,
            types: 'host',
          });
        },
      },
    })
    .state('offer.host.edit', {
      url: '?status',
      template: '<offer-host-edit user="app.user"></offer-host-edit>',
      requiresAuth: true,
      footerHidden: true,
      data: {
        pageTitle: 'Host travellers',
      },
    })
    .state('offer.meet', {
      url: '/meet',
      abstract: true,
      requiresAuth: true,
      template: '<div ui-view></div>',
      controller: 'OfferController',
      controllerAs: 'offer',
    })
    .state('offer.meet.list', {
      url: '',
      templateUrl: meetListTemplateUrl,
      requiresAuth: true,
      controller: 'OfferListMeetController',
      controllerAs: 'offerListMeet',
      data: {
        pageTitle: 'Meet',
      },
      resolve: {
        // A string value resolves to a service
        OffersByService: 'OffersByService',

        offers: function(OffersByService, Authentication) {
          return OffersByService.query({
            userId: Authentication.user._id,
            types: 'meet',
          });
        },
      },
    })
    .state('offer.meet.add', {
      url: '/add',
      templateUrl: meetEditTemplateUrl,
      requiresAuth: true,
      footerHidden: true,
      controller: 'OfferMeetAddController',
      controllerAs: 'offerMeet',
      data: {
        pageTitle: 'Add meeting offer',
      },
    })
    .state('offer.meet.edit', {
      url: '/:offerId',
      templateUrl: meetEditTemplateUrl,
      requiresAuth: true,
      footerHidden: true,
      controller: 'OfferMeetEditController',
      controllerAs: 'offerMeet',
      data: {
        pageTitle: 'Edit meeting offer',
      },
      resolve: {
        offer: getOffer,
      },
    });

  /* @ngInject */
  function getOffer($stateParams, OffersService) {
    return OffersService.get({
      offerId: $stateParams.offerId,
    }).$promise;
  }
}
