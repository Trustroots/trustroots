'use strict';

//References services used to communicate References REST endpoints

angular.module('references').factory('References', ['$resource',
	function($resource) {
		return $resource('references/:referenceId', {
			referenceId: '@id'
		}, {
			update: {
				method: 'PUT'
			}
		});
	}
]);

angular.module('references').factory('ReferencesBy', ['$resource',
	function($resource) {
		return $resource('references-by/:userId', {
			userId: '@userId'
		});
	}
]);
