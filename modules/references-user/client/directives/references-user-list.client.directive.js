(function () {
  'use strict';

  /**
   * Referencess-user directive widget for leaving a reference to user
   *
   * Usage:
   *
   * ```
   * <div tr-references-user="userId"></div>
   * ```
   *
   * userToId: feedback receiver's id
   */
  angular
    .module('references-user')
    .directive('trReferencesUser', trReferencesUserDirective);

  /* @ngInject */
  function trReferencesUserDirective() {
    var directive = {
      restrict: 'A',
      replace: true,
      templateUrl: '/modules/references-user/views/directives/tr-references-user-list.client.view.html',
      scope: {
        userId: '=trReferencesUser'
      },
      controller: trReferencesUserDirectiveController,
      controllerAs: 'referencesUser',
      bindToController: true // because the scope is isolated
    };

    return directive;
  }

  // Note: Note that the directive's controller is outside the directive's closure.
  // This style eliminates issues where the injection gets created as unreachable code after a return.
  /* @ngInject */
  function trReferencesUserDirectiveController($scope, ReferenceUserService) {

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
      ReferenceUserService.get({
        userId: vm.userId
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
