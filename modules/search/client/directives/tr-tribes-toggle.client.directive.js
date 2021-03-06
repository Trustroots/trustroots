import templateUrl from '@/modules/search/client/views/directives/tr-tribes-toggle.client.view.html';

/**
 * Directive to show tribe selector filter
 * Keeps a list of tribe ids up to date in scope variable
 * Also if scope variable is updated from the controller,
 * toggles in directive will be updated.
 *
 * Usage:
 * `<div tr-tribes-toggle="tribeIds"></div>`
 */
angular.module('search').directive('trTribesToggle', trTribesToggleDirective);

/* @ngInject */
function trTribesToggleDirective(TribesService) {
  let ignoreToggles = false;

  const directive = {
    restrict: 'A',
    replace: true,
    scope: {
      tribeIds: '=trTribesToggle',
    },
    templateUrl,
    controller: trTribesToggleDirectiveController,
    controllerAs: 'trTribesToggle',
  };

  return directive;

  /* @ngInject */
  function trTribesToggleDirectiveController($scope) {
    // View Model
    const vm = this;

    // Get all the tribes
    vm.tribes = TribesService.query();

    // States of toggle switches inside this directive
    // `{ tribeId: true|false, ... }`
    vm.toggles = {};
    vm.onToggleChange = onToggleChange;

    // Init
    activate();

    /**
     * Initialize directive controller
     */
    function activate() {
      if ($scope.tribeIds && $scope.tribeIds.length) {
        angular.forEach($scope.tribeIds, function (tribeId) {
          vm.toggles[tribeId] = true;
        });
      }
    }

    /**
     * State of a toggle switch has changed. Map toggles which are on
     * into an array of tribe ids: `[id1, id2, ...]`
     */
    function onToggleChange() {
      const TribeIds = [];
      angular.forEach(vm.toggles, function (active, tribeId) {
        if (active) TribeIds.push(tribeId);
      });
      // Tell tribeIds $watch that we changed `$scope.TribeIds`
      // from inside the directive
      ignoreToggles = true;
      $scope.tribeIds = TribeIds;
    }

    /**
     * Receives an array of tribes id's from outside the directive
     * and toggles them active within this directive
     */
    $scope.$watchCollection(
      'tribeIds',
      function tribeIdsWatch(newTribeIds, oldTribeIds) {
        if (!angular.equals(newTribeIds, oldTribeIds)) {
          // `$scope.tribeIds` was changed by onToggleChange function
          // thus don't go trough toggle switches as they're already correct
          if (ignoreToggles) {
            ignoreToggles = false;
            return;
          }

          // Clear all previous toggles
          vm.toggles = {};
          if (newTribeIds && newTribeIds.length) {
            // Loop trough new values and set toggles on for requested tribes
            angular.forEach(newTribeIds, function (tribeId) {
              vm.toggles[tribeId] = true;
            });
          }
        }
      },
    );
  }
}
