(function () {
  'use strict';

  /**
   * Join tribe button
   */
  angular
    .module('tags')
    .run(trTribeJoinButtonTemplate)
    .directive('trTribeJoinButton', trTribeJoinButtonDirective);

  /* @ngInject */
  function trTribeJoinButtonTemplate($templateCache) {
    var buttonTemplate = [
      '<button type="button" ng-class="{\'btn-active\': isMember}" ng-click="toggleMembership()" ng-disabled="isLoading" uib-tooltip="Leave Tribe" tooltip-enable="isMember" tooltip-placement="bottom">',
      '  <i ng-if="icon" ng-class="{\'icon-plus\': !isMember, \'icon-ok\': isMember}"></i> ',
      '  <span ng-if="!isMember" ng-bind="::joinLabel"></span>',
      '  <span ng-if="isMember" ng-bind="::joinedLabel"></span>',
      '</button>'
    ];
    $templateCache.put('tr-tribe-join-button.html', buttonTemplate.join(''));
  }

  /* @ngInject */
  function trTribeJoinButtonDirective(Authentication) {
    return {
      restrict: 'A',
      replace: true,
      scope: false,
      require: '^^trTribeJoin', // Require `tr-tribe-join` directive above this in DOM
      templateUrl: 'tr-tribe-join-button.html',
      link: trTribeJoinButtonDirectiveLink
    };

    function trTribeJoinButtonDirectiveLink(scope, elem, attrs, parentCtrl) {

      scope.isMember = parentCtrl.isMember;

      // Set labels
      scope.joinLabel = (angular.isUndefined(attrs.trTribeJoinLabel)) ? 'Join' : attrs.trTribeJoinLabel;
      scope.joinedLabel = (angular.isUndefined(attrs.trTribeJoinedLabel)) ? 'Joined' : attrs.trTribeJoinedLabel;

      // Set icon visibility
      scope.icon = !(angular.isDefined(attrs.trTribeJoinIcon) && (attrs.trTribeJoinIcon === false || attrs.trTribeJoinIcon === 'false'));

      /**
       * Toggle membership
       */
      scope.toggleMembership = function () {
        scope.isLoading = true;

        // If user is not authenticated, redirect them to signup page
        if (!Authentication.user) {
          parentCtrl.tribeSignup();
          return;
        }

        // Optimistic toggle without API action when joining
        if (!scope.isMember) {
          scope.isMember = true;
        }

        // Do the actual updating
        parentCtrl.toggleMembership().then(function (isMember) {
          scope.isLoading = false;
          scope.isMember = isMember;
        }, function (isMember) {
          scope.isLoading = false;
          scope.isMember = isMember;
        });
      };

    }
  }

}());
