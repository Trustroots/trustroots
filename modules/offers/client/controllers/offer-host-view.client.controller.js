angular
  .module('offers')
  .controller('OfferHostViewController', OfferHostViewController);

/* @ngInject */
function OfferHostViewController($scope, OffersByService) {
  // ViewModel
  const vm = this;

  // Exposed
  vm.offer = false;
  vm.hostingDropdown = false;
  vm.hostingStatusLabel = hostingStatusLabel;

  activate();

  /**
   * Initialize controller
   */
  function activate() {
    /**
     * Fetch offer
     * @todo: move to route resolve
     * @note: profileCtrl is a reference to parent "ControllerAs" (see users module)
     */
    if (
      $scope.profileCtrl.profile &&
      $scope.profileCtrl.profile.$resolved &&
      $scope.profileCtrl.profile._id
    ) {
      OffersByService.query(
        {
          userId: $scope.profileCtrl.profile._id,
          types: 'host',
        },
        function (offers) {
          if (!offers || !offers.length) {
            return;
          }

          vm.offer = offers[0];
          vm.offer.$resolved = true;
        },
      );
    }
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
