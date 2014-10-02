'use strict';

//Setting up route
angular.module('references').config(['$stateProvider',
	function($stateProvider) {
		// References state routing
		$stateProvider.
		state('listReferences', {
			url: '/references',
			templateUrl: 'modules/references/views/list-references.client.view.html'
		}).
		state('createReference', {
			url: '/references/create',
			templateUrl: 'modules/references/views/create-reference.client.view.html'
		}).
		state('viewReference', {
			url: '/references/:referenceId',
			templateUrl: 'modules/references/views/view-reference.client.view.html'
		}).
		state('editReference', {
			url: '/references/:referenceId/edit',
			templateUrl: 'modules/references/views/edit-reference.client.view.html'
		});
	}
]);