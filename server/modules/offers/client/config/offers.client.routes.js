(function () {
  angular
    .module('offers')
    .config(OffersRoutes);

  /* @ngInject */
  function OffersRoutes($stateProvider, $urlRouterProvider) {

    // Redirect parent states,
    // otherwise `/offer` would throw 404 because the route is `abstract`
    $urlRouterProvider.when('/offer', '/offer/host');

    $stateProvider.
      state('offer', {
        url: '/offer',
        abstract: true,
        requiresAuth: true,
        templateUrl: '/modules/offers/views/offer.client.view.html',
        controller: 'OfferController',
        controllerAs: 'offer',
        resolve: {
          // A string value resolves to a service
          LocationService: 'LocationService',

          // Initial default location for all offer maps
          defaultLocation: function (LocationService) {
            // Returns `{lat: Float, lng: Float, zoom: 4}`
            return LocationService.getDefaultLocation(4);
          }
        }
      }).
      state('offer.host', {
        url: '/host',
        abstract: true,
        requiresAuth: true,
        template: '<div ui-view></div>',
        controller: 'OfferController',
        controllerAs: 'offer',
        resolve: {
          // A string value resolves to a service
          OffersByService: 'OffersByService',

          offers: function (OffersByService, Authentication) {
            return OffersByService.query({
              userId: Authentication.user._id,
              types: 'host'
            });
          }
        }
      }).
      state('offer.host.edit', {
        url: '?status',
        templateUrl: '/modules/offers/views/offer-host-edit.client.view.html',
        requiresAuth: true,
        footerHidden: true,
        controller: 'OfferHostEditController',
        controllerAs: 'offerHostEdit',
        data: {
          pageTitle: 'Host travellers'
        }
      }).
      state('offer.meet', {
        url: '/meet',
        abstract: true,
        requiresAuth: true,
        template: '<div ui-view></div>',
        controller: 'OfferController',
        controllerAs: 'offer'
      }).
      state('offer.meet.list', {
        url: '',
        templateUrl: '/modules/offers/views/offer-meet-list.client.view.html',
        requiresAuth: true,
        controller: 'OfferListMeetController',
        controllerAs: 'offerListMeet',
        data: {
          pageTitle: 'Meet'
        },
        resolve: {
          // A string value resolves to a service
          OffersByService: 'OffersByService',

          offers: function (OffersByService, Authentication) {
            return OffersByService.query({
              userId: Authentication.user._id,
              types: 'meet'
            });
          }
        }
      }).
      state('offer.meet.add', {
        url: '/add',
        templateUrl: '/modules/offers/views/offer-meet-edit.client.view.html',
        requiresAuth: true,
        footerHidden: true,
        controller: 'OfferMeetAddController',
        controllerAs: 'offerMeet',
        data: {
          pageTitle: 'Add meeting offer'
        }
      }).
      state('offer.meet.edit', {
        url: '/:offerId',
        templateUrl: '/modules/offers/views/offer-meet-edit.client.view.html',
        requiresAuth: true,
        footerHidden: true,
        controller: 'OfferMeetEditController',
        controllerAs: 'offerMeet',
        data: {
          pageTitle: 'Edit meeting offer'
        },
        resolve: {
          offer: getOffer
        }
      });

    /* @ngInject */
    function getOffer($stateParams, OffersService) {
      return OffersService.get({
        offerId: $stateParams.offerId
      }).$promise;
    }

  }
}());
