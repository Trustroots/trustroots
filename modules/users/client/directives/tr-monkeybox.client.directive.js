'use strict';

/**
 * Monkeybox directive to show simple info box about profile
 */
angular.module('users').directive('trMonkeybox', ['SettingsFactory',
  function(SettingsFactory) {
    var appSettings = SettingsFactory.get();

    return {
      templateUrl: '/modules/users/views/directives/tr-monkeybox.client.view.html?c=' + appSettings.commit,
      restrict: 'A',
      replace: true,
      scope: {
        userId: '=userid'
      },
      controller: ['$scope', 'UsersMini', 'Languages', function($scope, UsersMini, Languages) {

        $scope.languages = Languages.get('object');

        if($scope.userId) {
          $scope.profile = UsersMini.get({
            userId: $scope.userId
          });
        }

      }]
    };
  }
]);
