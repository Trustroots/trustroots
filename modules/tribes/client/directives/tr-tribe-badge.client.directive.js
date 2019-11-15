(function () {
  /**
   * List tribes in common between two lists of tribes
   */
  angular
    .module('tribes')
    .directive('trTribeBadge', trTribeBadgeDirective);

  /* @ngInject */
  function trTribeBadgeDirective(TribeService) {
    return {
      templateUrl: '/modules/tribes/views/directives/tr-tribe-badge.client.view.html',
      restrict: 'AE',
      replace: true,
      scope: {
        tribe: '=trTribeBadge'
      },
      controller: trTribeBadgeController,
      controllerAs: 'tribeBadge'
    };

    /* @ngInject */
    function trTribeBadgeController($scope, $state) {

      // View Model
      var vm = this;

      // Exposed to the view
      vm.openTribe = openTribe;
      vm.tribe = $scope.tribe;

      /**
       * Open tribe
       */
      function openTribe() {
        // Put tribe object to cache to be used after page transition has
        // finished, thus no need to reload tribe from the API
        TribeService.fillCache(angular.copy(vm.tribe));
        $state.go('tribes.tribe', { 'tribe': vm.tribe.slug });
      }

    }
  }
}());
