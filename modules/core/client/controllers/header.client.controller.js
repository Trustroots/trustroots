(function(){
  'use strict';

  angular
    .module('core')
    .controller('HeaderController', HeaderController);

  /* @ngInject */
  function HeaderController($scope, $state) {

    // ViewModel
    var vm = this;

    // Exposed
    vm.isCollapsed = false;
    vm.isHidden = false;
    vm.toggleCollapsibleMenu = toggleCollapsibleMenu;

    function toggleCollapsibleMenu() {
      vm.isCollapsed = !vm.isCollapsed;
    }

    // Perform actions at page change
    $scope.$on('$stateChangeSuccess', function(event, toState, toParams, fromState, fromParams) {

      // Collapsing the menu after navigation
      vm.isCollapsed = false;

      // Hide header at certain pages
      vm.isHidden = (angular.isDefined(toState.headerHidden) && toState.headerHidden === true) ? true : false;
    });

  }

})();
