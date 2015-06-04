'use strict';

// Setting up route
angular.module('messages').config(['$stateProvider',
  function($stateProvider) {
    // Messages state routing
    $stateProvider.
    state('inboxMessages', {
      url: '/messages',
      templateUrl: 'modules/messages/views/inbox-messages.client.view.html',
      requiresAuth: true
    }).
    state('listMessages', {
      url: '/messages/:userId',
      templateUrl: 'modules/messages/views/thread-messages.client.view.html',
      requiresAuth: true,
      footerHidden: true
    });
  }
]);
