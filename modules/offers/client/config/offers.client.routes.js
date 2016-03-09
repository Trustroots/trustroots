(function() {
  'use strict';

  angular
    .module('offers')
    .config(OffersRoutes);

  /* @ngInject */
  function OffersRoutes($stateProvider) {

    $stateProvider.
      state('offer', {
        url: '/offer?status',
        title: 'Hosting',
        templateUrl: '/modules/offers/views/offers-edit.client.view.html',
        requiresAuth: true,
        controller: 'OffersEditController',
        controllerAs: 'offersEdit',
        resolve: {
          // A string value resolves to a service
          SettingsService: 'SettingsService',
          OffersByService: 'OffersByService',

          appSettings: function(SettingsService) {
            return SettingsService.get();
          },

          offer: function(OffersByService, Authentication) {
            return OffersByService.get({
              userId: Authentication.user._id
            });
          }
        }
      });
  }

})();
