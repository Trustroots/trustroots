'use strict';

//Offers service used for communicating with the offers REST endpoints
angular.module('offers').factory('Offers', ['$resource',
	function($resource) {
		return $resource('offers/:userId', {
			userId: '@_id'
		}, {
			update: {
				method: 'PUT'
			}
		});
	}
]);
