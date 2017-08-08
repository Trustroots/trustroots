(function () {
  'use strict';

  angular
    .module('offers')
    .controller('OfferMeetAddController', OfferMeetAddController);

  /* @ngInject */
  function OfferMeetAddController($window, $timeout, $http, $state, $stateParams, $analytics, leafletData, OffersService, Authentication, messageCenterService, defaultLocation) {

    // ViewModel
    var vm = this;

    // Expoxed to the view
    vm.leafletData = leafletData;
    vm.offer = {};
    vm.editOffer = editOffer;
    vm.mapCenter = defaultLocation;
    vm.isLoading = false;
    vm.newOffer = false;

    activate();

    /**
     * Initialize controller
     */
    function activate() {
      vm.newOffer = true;
    }

    /**
     * Add offer
     */
    function editOffer() {
      vm.isLoading = true;

      var newOffer = new OffersService({
        type: 'meet',
        description: vm.offer.description,
        location: [parseFloat(vm.mapCenter.lat), parseFloat(vm.mapCenter.lng)]
      });

      newOffer.$save(function() {
        // Done!
        vm.isLoading = false;
        $analytics.eventTrack('offer-modified', {
          category: 'offer.meet.add',
          label: 'Added meet offer'
        });
        $state.go('offer.meet.list');
      }, function(err) {
        vm.isLoading = false;
        var errorMessage = (err.data.message) ? err.data.message : 'Error occured. Please try again.';
        messageCenterService.add('danger', errorMessage);
      });

    }

  }

}());
