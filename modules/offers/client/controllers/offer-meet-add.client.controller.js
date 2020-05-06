angular
  .module('offers')
  .controller('OfferMeetAddController', OfferMeetAddController);

/* @ngInject */
function OfferMeetAddController(
  $state,
  $analytics,
  leafletData,
  OffersService,
  messageCenterService,
  defaultLocation,
) {
  // ViewModel
  const vm = this;

  // Expoxed to the view
  vm.leafletData = leafletData;
  vm.offer = {};
  vm.editOffer = editOffer;
  vm.mapCenter = defaultLocation;
  vm.isCalendarVisible = false;
  vm.isLoading = false;
  vm.newOffer = false;
  vm.minDescription = 5;

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

    const newOffer = new OffersService({
      type: 'meet',
      description: vm.offer.description,
      location: [parseFloat(vm.mapCenter.lat), parseFloat(vm.mapCenter.lng)],
      validUntil: vm.offer.validUntil,
    });

    newOffer.$save(
      function () {
        // Done!
        vm.isLoading = false;
        $analytics.eventTrack('offer-modified', {
          category: 'offer.meet.add',
          label: 'Added meet offer',
        });
        $state.go('offer.meet.list');
      },
      function (err) {
        vm.isLoading = false;
        const errorMessage = err.data.message
          ? err.data.message
          : 'Error occured. Please try again.';
        messageCenterService.add('danger', errorMessage);
      },
    );
  }
}
