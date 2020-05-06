angular
  .module('offers')
  .controller('OfferMeetEditController', OfferMeetEditController);

/* @ngInject */
function OfferMeetEditController(
  $state,
  $analytics,
  moment,
  leafletData,
  messageCenterService,
  offer,
  defaultLocation,
) {
  // ViewModel
  const vm = this;

  // Expoxed to the view
  vm.leafletData = leafletData;
  vm.offer = {};
  vm.editOffer = editOffer;
  vm.mapCenter = defaultLocation;
  vm.isLoading = false;
  vm.minDescription = 5;

  activate();

  /**
   * Initialize controller
   */
  function activate() {
    // Make sure offer is there
    offer.$promise.then(
      function () {
        // Turn string date into a date object so that we can modify it
        if (offer.validUntil) {
          offer.validUntil = moment(offer.validUntil).toDate();
        }

        vm.offer = offer;

        // Populate map
        if (vm.offer && vm.offer.location) {
          vm.mapCenter.lat = parseFloat(vm.offer.location[0]) || 0;
          vm.mapCenter.lng = parseFloat(vm.offer.location[1]) || 0;
          vm.mapCenter.zoom = 16;
        }
      },
      // Could not load offer
      function () {
        vm.offer = false;
      },
    );
  }

  /**
   * Add offer
   */
  function editOffer() {
    vm.isLoading = true;

    offer.type = 'meet';
    offer.status = 'yes';
    offer.description = vm.offer.description;
    offer.location = [
      parseFloat(vm.mapCenter.lat),
      parseFloat(vm.mapCenter.lng),
    ];

    const offerId = offer._id || false;

    offer
      .$update(
        function () {
          // Done!
          $analytics.eventTrack('offer-modified', {
            category: 'offer.meet.update',
            label: 'Updated meet offer',
          });

          // If offer already has id, add it to URL
          // $state will then scroll to it:
          // that's useful if there are multiple offers on the list.
          if (offerId) {
            $state.go('offer.meet.list', { '#': 'offer-' + offerId });
          } else {
            $state.go('offer.meet.list');
          }
        },
        function (err) {
          const errorMessage = err.data.message
            ? err.data.message
            : 'Error occured. Please try again.';
          messageCenterService.add('danger', errorMessage);
        },
      )
      .finally(function () {
        vm.isLoading = false;
      });
  }
}
