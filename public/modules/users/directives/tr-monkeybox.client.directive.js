'use strict';

/**
 * Monkeybox directive to show simple info box about profile
 */
angular.module('users').directive('trMonkeybox', [
	function() {
		return {
			templateUrl: '/modules/users/views/directives/tr-monkeybox.client.view.html',
			restrict: 'A', //only matches attribute name
            scope: {
              user: '=user'
            }
		};
	}
]);