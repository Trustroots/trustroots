(function () {
  'use strict';

  angular
    .module('offers')
    .controller('OfferListMeetController', OfferListMeetController);

  /* @ngInject */
  function OfferListMeetController(offers, $state, $analytics, $confirm, OffersService, messageCenterService) {

    // ViewModel
    var vm = this;

    // Expoxed to the view
    vm.offers = offers;
    vm.remove = remove;

    function remove(offer) {

      // Index of this `offer` in `vm.offers` array
      var index = vm.offers.indexOf(offer);

      // Ask for confirmation
      $confirm({
        // title: 'Are you sure?',
        text: 'Are you sure you want to remove this?',
        ok: 'Remove',
        cancel: 'Cancel'
      })
      // If user pressed "continue", create another state go
      .then(function() {
        new OffersService(offer).$delete(function() {
          $analytics.eventTrack('offer-delete', {
            category: 'offer.meet.delete',
            label: 'Removed meet offer'
          });

          // Remove `offer` from `vm.offers` array
          vm.offers.splice(index, 1);
        }, function(err) {
          var errorMessage = (err.data.message) ? err.data.message : 'Error occured. Please try again.';
          messageCenterService.add('danger', errorMessage);
        });
      });

    }

  }

}());
