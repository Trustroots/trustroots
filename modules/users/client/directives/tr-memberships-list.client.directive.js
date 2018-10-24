(function () {
  'use strict';

  /**
   * Simple list of tribes user is member of
   */
  angular
    .module('users')
    .directive('trMembershipsList', trMembershipsListDirective);

  /* @ngInject */
  function trMembershipsListDirective(Authentication) {
    return {
      templateUrl: '/modules/users/views/directives/tr-memberships-list.client.view.html',
      restrict: 'A',
      replace: true,
      scope: {
        trMembershipsList: '=',
        isOwnProfile: '='
      },
      controller: trMembershipsListController,
      controllerAs: 'tribesMembershipsList'
    };

    /* @ngInject */
    function trMembershipsListController($scope) {

      // View Model
      var vm = this;

      // Exposed to the view
      vm.memberships = [];

      activate();

      /**
       * Initialize directive controller
       */
      function activate() {
        var nonCommonTribes = [];

        if ($scope.isOwnProfile) {
          vm.memberships = $scope.trMembershipsList;
          // Loop all tribes memberships
        } else if (angular.isDefined($scope.trMembershipsList) &&
          angular.isArray($scope.trMembershipsList) &&
          Authentication.user.memberIds &&
          Authentication.user.memberIds.length > 0) {
          angular.forEach($scope.trMembershipsList, function (membership) {
            // If authenticated user has it as well, it's already visible in the common tribes list
            // so do not add it
            if (membership.tribe && Authentication.user.memberIds.indexOf(membership.tribe._id) < 0) {
              nonCommonTribes.push(membership);
            }
          });
          vm.memberships = nonCommonTribes;
        }
      }
    }
  }
}());
