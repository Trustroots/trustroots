import templateUrl from '@/modules/tribes/client/views/directives/tr-tribes-in-common.client.view.html';

/**
 * List tribes in common between two lists of tribes
 */
angular
  .module('tribes')
  .directive('trTribesInCommon', trTribesInCommonDirective);

/* @ngInject */
function trTribesInCommonDirective(Authentication, TribeService) {
  return {
    templateUrl,
    restrict: 'A',
    replace: true,
    scope: {
      trTribesInCommon: '=',
    },
    controller: trTribesInCommonController,
    controllerAs: 'tribesInCommon',
  };

  /* @ngInject */
  function trTribesInCommonController($scope, $state) {
    // View Model
    const vm = this;

    // Exposed to the view
    vm.openTribe = openTribe;
    vm.memberships = [];

    activate();

    /**
     * Initialize directive controller
     */
    function activate() {
      $scope.$watch('trTribesInCommon', function () {
        const tribesInCommon = [];

        // Loop all tribes memberships
        if (
          angular.isDefined($scope.trTribesInCommon) &&
          angular.isArray($scope.trTribesInCommon) &&
          Authentication.user.memberIds &&
          Authentication.user.memberIds.length > 0
        ) {
          angular.forEach($scope.trTribesInCommon, function (membership) {
            // If authenticated user has it as well, add to list
            if (
              membership.tribe &&
              Authentication.user.memberIds.indexOf(membership.tribe._id) > -1
            ) {
              tribesInCommon.push(membership);
            }
          });
        }

        vm.memberships = tribesInCommon;
      });
    }

    /**
     * Open tribe
     */
    function openTribe(tribe) {
      // Put tribe object to cache to be used after page transition has
      // finished, thus no need to reload tribe from the API
      TribeService.fillCache(angular.copy(tribe));
      $state.go('circles.circle', { circle: tribe.slug });
    }
  }
}
