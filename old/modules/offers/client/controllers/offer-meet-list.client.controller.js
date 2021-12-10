angular
  .module('offers')
  .controller('OfferListMeetController', OfferListMeetController);

/* @ngInject */
function OfferListMeetController(
  offers,
  $timeout,
  $anchorScroll,
  $analytics,
  $confirm,
  OffersService,
  messageCenterService,
) {
  // ViewModel
  const vm = this;

  // Expoxed to the view
  vm.offers = offers;
  vm.remove = remove;

  activate();

  /**
   * Activate controller
   */
  function activate() {
    /**
     * If URL has hash (e.g. `#offer-5994afbf2beea2a88184104f`), scroll to it
     * @link https://docs.angularjs.org/api/ng/service/$anchorScroll
     */
    $timeout(function () {
      // Offset for scrolling position
      $anchorScroll.yOffset = function () {
        const $header = angular.element('#tr-header');
        // Set y-axis offset for scrolling to element to header's height
        return $header.length ? $header.height() + 5 : 50;
      };
      $anchorScroll();
    }, 500);
  }

  /**
   * Remove offer
   */
  function remove(offer) {
    // Index of this `offer` in `vm.offers` array
    const index = vm.offers.indexOf(offer);

    // Ask for confirmation
    $confirm({
      // title: 'Are you sure?',
      text: 'Are you sure you want to remove this?',
      ok: 'Remove',
      cancel: 'Cancel',
    })
      // If user pressed "continue", create another state go
      .then(function () {
        new OffersService(offer).$delete(
          function () {
            $analytics.eventTrack('offer-delete', {
              category: 'offer.meet.delete',
              label: 'Removed meet offer',
            });

            // Remove `offer` from `vm.offers` array
            vm.offers.splice(index, 1);
          },
          function (err) {
            const errorMessage = err.data.message
              ? err.data.message
              : 'Error occured. Please try again.';
            messageCenterService.add('danger', errorMessage);
          },
        );
      });
  }
}
