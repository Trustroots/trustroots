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
    vm.isTransparent = false;
    vm.isHidden = false;

    // Changing footer styles/contents after navigation
    $scope.$on('$stateChangeSuccess', function(event, toState) {

      // Footer is transparent on these pages
      vm.isTransparent = (angular.isDefined(toState.footerTransparent) && toState.footerTransparent === true);

      // Footer is hidden on these pages
      vm.isHidden = (angular.isDefined(toState.footerHidden) && toState.footerHidden === true);

    });


  }

}());
