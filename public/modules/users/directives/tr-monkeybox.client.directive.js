'use strict';

/**
 * Monkeybox directive to show simple info box about profile
 */
angular.module('users').directive('trMonkeybox', [
	function() {
		return {
			templateUrl: '/modules/users/views/directives/tr-monkeybox.client.view.html',
			restrict: 'A', //only matches attribute name
			replace: true,
			scope: {
				userid: '=userid'
			},
			controller: ['$scope', 'UsersMini', function($scope, UsersMini) {

				$scope.languages = window.languages;

				// Miniprofile of the user
				if($scope.userid) {
          $scope.user = UsersMini.get({
          	userId: $scope.userid
          });
			  }
			}]
		};
	}
]);
