(function () {
  'use strict';

  angular
    .module('core')
    .controller('FooterController', FooterController);

  /* @ngInject */
  function FooterController($scope) {

    // ViewModel
    var vm = this;

    // Exposed
    vm.isHidden = false;

    // Changing footer styles/contents after navigation
    $scope.$on('$stateChangeSuccess', function(event, toState) {
      // Footer is hidden on these pages
      vm.isHidden = (angular.isDefined(toState.footerHidden) && toState.footerHidden === true);
    });

  }

}());
