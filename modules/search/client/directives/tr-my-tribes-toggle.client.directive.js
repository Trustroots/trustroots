import templateUrl from '@/modules/search/client/views/directives/tr-my-tribes-toggle.client.view.html';

/**
 * Directive to
 *
 * Usage:
 * `<div tr-my-tribes-toggle="tribeIds"></div>`
 */
angular
  .module('search')
  .directive('trMyTribesToggle', trMyTribesToggleDirective);

/* @ngInject */
function trMyTribesToggleDirective(UserMembershipsService) {
  const directive = {
    restrict: 'A',
    replace: true,
    scope: {
      tribeIds: '=trMyTribesToggle',
    },
    templateUrl,
    controller: trMyTribesToggleController,
    controllerAs: 'myTribesToggle',
  };

  return directive;

  /* @ngInject */
  function trMyTribesToggleController($scope) {
    // Flag used to detect if toggle was touched
    let toggled = false;

    // View Model
    const vm = this;

    vm.onChange = onChange;
    vm.toggle = false;
    vm.initialized = false;
    vm.userTribes = [];

    // Fill `vm.userTribes`
    collectUserTribeIds();

    /**
     * Receives an array of tribes id's from outside the directive
     * and switches this toggle off
     */
    $scope.$watchCollection('tribeIds', function () {
      if (toggled) {
        toggled = false;
        return;
      }
      toggled = false;
      vm.toggle = false;
    });

    /**
     * Initialize memberships array
     * Collects ids of tribes
     * from user's `member` collection.
     */
    function collectUserTribeIds() {
      UserMembershipsService.query()
        .$promise.then(function (userMemberships) {
          if (!angular.isArray(userMemberships) || !userMemberships.length) {
            return;
          }

          // Fill `vm.userTribes` array with ids of tribes
          const tribeIds = [];
          angular.forEach(userMemberships, function (membership) {
            tribeIds.push(membership.tribe._id);
          });
          vm.userTribes = tribeIds;
        })
        .finally(function () {
          vm.initialized = true;
        });
    }

    /**
     * Get an array of tribe objects from an array of user membersip objects
     * Returns a promise
     */
    function onChange() {
      toggled = true;

      // Toggle was set `false`, no need to react
      if (vm.toggle === false) {
        return;
      }

      // If toggle was set `true`, wipe out old tribe ids
      // and replace them with user's tribe ids
      $scope.tribeIds = vm.userTribes;
    }
  }
}
