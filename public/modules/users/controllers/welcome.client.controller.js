'use strict';

angular.module('users').controller('WelcomeController', ['$scope', '$location', 'Authentication',
	function($scope, $location, Authentication) {

		// If user is not signed in then redirect back home
		if (!Authentication.user) $location.path('/');

	}
]);