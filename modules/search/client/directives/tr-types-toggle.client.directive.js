import templateUrl from '@/modules/search/client/views/directives/tr-types-toggle.client.view.html';

/**
 * Directive to show offer type selector filter
 * Keeps a list of types up to date in scope variable
 * Also if scope variable is updated from the controller,
 * toggles in directive will be updated.
 *
 * Usage:
 * `<div tr-types-toggle="types"></div>`
 */
angular.module('search').directive('trTypesToggle', trTypesToggleDirective);

/* @ngInject */
function trTypesToggleDirective() {
  let ignoreToggles = false;

  const directive = {
    restrict: 'A',
    replace: true,
    scope: {
      types: '=trTypesToggle',
    },
    templateUrl,
    controller: trTypesToggleDirectiveController,
    controllerAs: 'trTypesToggle',
  };

  return directive;

  /* @ngInject */
  function trTypesToggleDirectiveController($scope) {
    // View Model
    const vm = this;

    // Offer types and their labels
    vm.types = [
      {
        id: 'host',
        label: 'Hosts',
      },
      {
        id: 'meet',
        label: 'Meetups',
      },
    ];

    // States of toggle switches inside this directive
    // `{ id: true|false, ... }`
    vm.toggles = {};
    vm.onToggleChange = onToggleChange;

    // Init
    activate();

    /**
     * Initialize directive controller
     */
    function activate() {
      if ($scope.types && $scope.types.length) {
        angular.forEach($scope.types, function (type) {
          vm.toggles[type] = true;
        });
      }
    }

    /**
     * State of a toggle switch has changed. Map toggles which are on
     * into an array of tribe ids: `[id1, id2, ...]`
     */
    function onToggleChange() {
      const types = [];
      angular.forEach(vm.toggles, function (active, type) {
        if (active) {
          types.push(type);
        }
      });
      // Tell tribeIds $watch that we changed `$scope.types`
      // from inside the directive
      ignoreToggles = true;
      $scope.types = types;
    }

    /**
     * Receives an array of types id's from outside the directive
     * and toggles them active within this directive
     */
    $scope.$watchCollection('types', function typesWatch(newTypes, oldTypes) {
      if (!angular.equals(newTypes, oldTypes)) {
        // `$scope.types` was changed by onToggleChange function
        // thus don't go trough toggle switches as they're already correct
        if (ignoreToggles) {
          ignoreToggles = false;
          return;
        }

        // Clear all previous toggles
        vm.toggles = {};
        if (newTypes && newTypes.length) {
          // Loop trough new values and set toggles on for requested types
          angular.forEach(newTypes, function (type) {
            vm.toggles[type.id] = true;
          });
        }
      }
    });
  }
}
