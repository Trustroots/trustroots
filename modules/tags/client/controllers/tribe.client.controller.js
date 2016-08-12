(function () {
  'use strict';

  angular
    .module('tags')
    .controller('TribeController', TribeController);

  /* @ngInject */
  function TribeController($scope, $state, tribe) {

    var headerHeight = angular.element('#tr-header').height() || 0;

    // ViewModel
    var vm = this;

    // Exposed to the view
    vm.tribe = tribe;
    vm.windowHeight = angular.element('html').height() - headerHeight;
    vm.goBack = goBack;

    // `tr-tribe-join-button` and `tr-tribe-join` directives expect
    // `tribe` to be directly on their scope, as they don't have their own scope.
    // eslint-disable-next-line angular/controller-as
    $scope.tribe = tribe;

    /**
     * Go to tribe grid
     */
    function goBack() {
      $state.go('tribes.list');
    }

  }

}());
