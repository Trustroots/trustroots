'use strict';

// Setting up route
angular.module('messages').config(['$stateProvider',
	function($stateProvider) {
		// Messages state routing
		$stateProvider.
		state('inboxMessages', {
			url: '/messages',
			templateUrl: 'modules/messages/views/inbox-messages.client.view.html'
		}).
		state('listMessages', {
			url: '/messages/:userId',
			templateUrl: 'modules/messages/views/thread-messages.client.view.html'
		});
		/*.
		state('createMessage', {
			url: '/messages/create',
			templateUrl: 'modules/messages/views/create-message.client.view.html'
		}).
		state('viewMessage', {
			url: '/messages/:messageId',
			templateUrl: 'modules/messages/views/view-message.client.view.html'
		}).
		state('editMessage', {
			url: '/messages/:messageId/edit',
			templateUrl: 'modules/messages/views/edit-message.client.view.html'
		});*/
	}
]);