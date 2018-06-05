(function () {
  'use strict';

  /**
   * Referencess-user directive widget for leaving a reference to user
   *
   * Usage:
   *
   * ```
   * <div tr-references-list="userId"></div>
   * ```
   *
   * userToId: feedback receiver's id
   */
  angular
    .module('references')
    .directive('trReferencesList', trReferencesListDirective);

  /* @ngInject */
  function trReferencesListDirective() {
    var directive = {
      restrict: 'A',
      replace: true,
      templateUrl: '/modules/references/views/directives/tr-references-list.client.view.html',
      scope: {
        userToId: '=user'
      },
      controller: trReferencesListDirectiveController,
      controllerAs: 'references',
      bindToController: true // because the scope is isolated
    };

    return directive;
  }

  // Note: Note that the directive's controller is outside the directive's closure.
  // This style eliminates issues where the injection gets created as unreachable code after a return.
  /* @ngInject */
  function trReferencesListDirectiveController($scope, ReferencesService) {

    // View Model
    var vm = this;

    // Exposed to the view
    vm.isLoading = true;
    vm.references = [];
    // vm.userId = vm.userId;

    activate();

    /**
     * Look for previous answers from the API
     */
    function activate() {
      ReferencesService.query({
        userToId: vm.userToId
      }, function (references) {
        vm.isLoading = false;
        if (angular.isArray(references)) {
          vm.references = references;
        }
      }, function () {
        vm.isLoading = false;
      });
    }

  }

}());
