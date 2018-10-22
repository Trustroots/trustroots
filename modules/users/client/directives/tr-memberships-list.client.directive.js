(function () {
  'use strict';

  /**
   * Simple list of tribes user is member of
   */
  angular
    .module('users')
    .directive('trMembershipsList', trMembershipsListDirective);

  /* @ngInject */
  function trMembershipsListDirective() {
    return {
      templateUrl: '/modules/users/views/directives/tr-memberships-list.client.view.html',
      restrict: 'A',
      replace: true,
      scope: {
        memberships: '=trMembershipsList',
        isOwnProfile: '='
      },
      controller: trMembershipsListController

    };
  }

  function trMembershipsListController($scope) {
    $scope.displayAllTribes = false;
    $scope.toggle = function () {
      $scope.displayAllTribes = true;
    };
  }

}());
