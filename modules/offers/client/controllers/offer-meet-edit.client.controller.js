(function () {
  'use strict';

  angular
    .module('offers')
    .controller('OfferMeetEditController', OfferMeetEditController);

  /* @ngInject */
  function OfferMeetEditController($window, $timeout, $http, $state, $stateParams, $analytics, leafletData, OffersService, Authentication, messageCenterService, offer, defaultLocation) {

    // ViewModel
    var vm = this;

    // Expoxed to the view
    vm.leafletData = leafletData;
    vm.offer = {};
    vm.editOffer = editOffer;
    vm.mapCenter = defaultLocation;
    vm.isLoading = false;


    activate();

    /**
     * Initialize controller
     */
    function activate() {

      // Make sure offer is there
      offer.$promise.then(function() {

        vm.offer = offer;

        // Populate map if user ralready has an offer
        if (vm.offer && vm.offer.location) {
          vm.mapCenter.lat = parseFloat(vm.offer.location[0]);
          vm.mapCenter.lng = parseFloat(vm.offer.location[1]);
          vm.mapCenter.zoom = 16;
        }

      },
      // Could not load offer
      function() {
        vm.offer = false;
      });

    }


    /**
     * Add offer
     */
    function editOffer() {
      vm.isLoading = true;

      offer.type = 'meet';
      offer.status = 'yes';
      offer.description = vm.offer.description;
      offer.location = [parseFloat(vm.mapCenter.lat), parseFloat(vm.mapCenter.lng)];

      offer.$update(function() {
        // Done!
        $analytics.eventTrack('offer-modified', {
          category: 'offer.meet.update',
          label: 'Updated meet offer'
        });
        $state.go('offer.meet.list');
      }, function(err) {
        var errorMessage = (err.data.message) ? err.data.message : 'Error occured. Please try again.';
        messageCenterService.add('danger', errorMessage);
      }).finally(function() {
        vm.isLoading = false;
      });

    }

  }

}());
