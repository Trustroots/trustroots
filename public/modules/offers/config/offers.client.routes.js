'use strict';

//Setting up route
angular.module('offers').config(['$stateProvider',
	function($stateProvider) {
		// Offers state routing
		$stateProvider.
		state('offer-status', {
			url: '/offer/?status',
			templateUrl: 'modules/offers/views/offer-form.client.view.html'
		}).
		state('offer', {
			url: '/offer',
			templateUrl: 'modules/offers/views/offer-form.client.view.html'
		});
	}
]);
