'use strict';

//References service used to communicate References REST endpoints
angular.module('references').factory('References', ['$resource',
	function($resource) {
		return $resource('references/:referenceId', { referenceId: '@_id'
		}, {
			update: {
				method: 'PUT'
			}
		});
	}
]);