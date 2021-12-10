angular.module('tribes').controller('TribeController', TribeController);

/* @ngInject */
function TribeController($scope, $state, tribe, Facebook) {
  const headerHeight = angular.element('#tr-header').height() || 0;

  // ViewModel
  const vm = this;

  // Exposed to the view
  vm.tribe = tribe;
  vm.windowHeight = angular.element('html').height() - headerHeight;
  vm.goBack = goBack;
  vm.facebookIsActibe = Facebook.isActive;

  // Ensure tribe in view updates when directives modify it
  $scope.$on('tribeUpdated', function (event, tribe) {
    vm.tribe = tribe;
  });

  /**
   * Go to tribe grid
   */
  function goBack() {
    $state.go('circles.list');
  }
}
