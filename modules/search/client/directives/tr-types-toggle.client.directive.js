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

    // Selectable offer types. Meetups are always included in the published
    // filter, but no longer need their own map control.
    vm.types = [
      {
        id: 'host',
        label: 'Hosts',
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
      vm.toggles.host = includesType($scope.types, 'host');
      publishTypes(false);
    }

    function includesType(types, requestedType) {
      return (types || []).some(function (type) {
        return (angular.isObject(type) ? type.id : type) === requestedType;
      });
    }

    function publishTypes(ignoreWatcher) {
      const types = vm.toggles.host ? ['host', 'meet'] : ['meet'];

      if (!angular.equals($scope.types, types)) {
        // Tell the watcher when this value came from a visible toggle. During
        // activation, the watcher has not been registered yet.
        ignoreToggles = ignoreWatcher;
        $scope.types = types;
      }
    }

    /**
     * State of a toggle switch has changed. Map toggles which are on
     * into an array of tribe ids: `[id1, id2, ...]`
     */
    function onToggleChange() {
      publishTypes(true);
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

        vm.toggles = {
          host: includesType(newTypes, 'host'),
        };
        publishTypes(true);
      }
    });
  }
}
