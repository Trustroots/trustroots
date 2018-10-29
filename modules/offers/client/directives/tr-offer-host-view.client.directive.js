(function () {
  'use strict';

  angular
    .module('offers')
    .directive('trOfferHostView', trOfferHostViewDirective);

  /* @ngInject */
  function trOfferHostViewDirective() {
    var directive = {
      restrict: 'A',
      replace: true,
      scope: {
        profile: '=trOfferHostView', // Profile who's offer to load
        authUser: '=trOfferHostViewAuthUser' // Currently authenticated user
      },
      templateUrl: '/modules/offers/views/directives/tr-offer-host-view.client.view.html',
      controller: trOfferHostViewDirectiveController,
      controllerAs: 'trOfferHost'
    };

    return directive;

    /* @ngInject */
    function trOfferHostViewDirectiveController($scope, $window, OffersByService) {

      // ViewModel
      var vm = this;

      // Exposed
      vm.offer = false;
      vm.isLoading = true;
      vm.isOwnOffer = false;
      vm.profile = false;
      vm.isUserPublic = false;
      vm.hostingDropdown = false;
      vm.hostingStatusLabel = hostingStatusLabel;
      vm.isMobile = $window.navigator.userAgent.toLowerCase().indexOf('mobile') >= 0 || $window.isNativeMobileApp;
      activate();

      /**
       * Initialize controller
       */
      function activate() {

        if (!$scope.profile) {
          vm.isLoading = false;
          return;
        }

        /**
         * Fetch offer
         * @todo: move to route resolve
         * @note: profileCtrl is a reference to parent "ControllerAs" (see users module)
         */
        $scope.profile.$promise.then(function (profile) {
          if (profile && profile._id) {

            vm.profile = profile;
            vm.isOwnOffer = ($scope.authUser && $scope.authUser._id && $scope.authUser._id === profile._id);
            vm.isUserPublic = ($scope.authUser && $scope.authUser.public);

            OffersByService.query({
              userId: String(profile._id),
              types: 'host'
            }, function (offers) {

              if (!offers || !offers.length) {
                vm.isLoading = false;
                return;
              }

              vm.offer = offers[0];
              vm.isLoading = false;
            }, function () {
              // No offer(s) found
              vm.isLoading = false;
            });
          }
        });
      }

      /**
       * Helper for hosting label
       */
      function hostingStatusLabel(status) {
        switch (status) {
          case 'yes':
            return 'Can host';
          case 'maybe':
            return 'Might be able to host';
          default:
            return 'Cannot host currently';
        }
      }

    }

  }

}());
