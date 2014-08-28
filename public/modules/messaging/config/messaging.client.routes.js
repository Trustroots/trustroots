'use strict';

//Setting up route
angular.module('messaging').config(['$stateProvider',
	function($stateProvider) {
		// Messaging state routing
		$stateProvider.
		state('messaging', {
			url: '/messaging',
			templateUrl: 'modules/messaging/views/messaging.client.view.html'
		});
	}
]);