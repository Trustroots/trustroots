(function () {
  angular
    .module('tribes')
    .controller('TribesListController', TribesListController);

  /* @ngInject */
  function TribesListController(tribes, $state, Authentication, TribeService, $scope) {

    // ViewModel
    const vm = this;

    // Exposed to the view
    vm.tribes = tribes;
    vm.user = Authentication.user;
    vm.openTribe = openTribe;
    vm.emitPhotoCredits = emitPhotoCredits;

    /**
     * Open tribe
     */
    function openTribe(tribe) {
      // Put tribe object to cache to be used after page transition has
      // finished, thus no need to reload tribe from the API
      TribeService.fillCache(angular.copy(tribe));
      $state.go('tribes.tribe', { 'tribe': tribe.slug });
    }

    /**
     * Emit photo credits info
     * @TODO remove this
     */
    function emitPhotoCredits(photo) {
      $scope.$emit('photoCreditsUpdated', photo);
    }
  }
}());
