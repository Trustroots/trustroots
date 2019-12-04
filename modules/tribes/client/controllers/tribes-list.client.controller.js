(function () {
  angular
    .module('tribes')
    .controller('TribesListController', TribesListController);

  /* @ngInject */
  function TribesListController(tribes, $state, Authentication, TribeService) {

    // ViewModel
    const vm = this;

    // Exposed to the view
    vm.tribes = tribes;
    vm.user = Authentication.user;
    vm.openTribe = openTribe;

    /**
     * Open tribe
     */
    function openTribe(tribe) {
      // Put tribe object to cache to be used after page transition has
      // finished, thus no need to reload tribe from the API
      TribeService.fillCache(angular.copy(tribe));
      $state.go('tribes.tribe', { 'tribe': tribe.slug });
    }
  }
}());
