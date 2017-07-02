(function () {
  'use strict';

  angular
    .module('core')
    .controller('HeaderController', HeaderController);

  /* @ngInject */
  function HeaderController($scope, $state) {

    // ViewModel
    var vm = this;

    // Exposed
    vm.$state = $state;
    vm.isHeaderHidden = false;

    activate();

    /**
     * Initialize controller
     */
    function activate() {

      // Perform actions at page change
      $scope.$on('$stateChangeSuccess', function(event, toState) {
        // Hide header at certain pages
        vm.isHeaderHidden = (angular.isDefined(toState.headerHidden) && toState.headerHidden === true);
      });
    }

  }

}());
