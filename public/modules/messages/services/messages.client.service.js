'use strict';

//Messages service used for communicating with the messages REST endpoints
angular.module('messages').factory('Messages', ['$resource',
	function($resource) {
		return $resource('messages/:userId', {
			userId: '@_id'
		}, {
			update: {
				method: 'PUT'
			}
		});
	}
]);