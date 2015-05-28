'use strict';

//Setting up route
angular.module('contacts').config(['$stateProvider',
  function($stateProvider) {
    // Contact state routing
    $stateProvider.
    state('contactAdd', {
      url: '/add-contact/:userId',
      templateUrl: 'modules/contacts/views/add-contact.client.view.html',
      requiresAuth: true
    }).
    state('contactConfirm', {
      url: '/contact-confirm/:contactId',
      templateUrl: 'modules/contacts/views/confirm-contact.client.view.html',
      requiresAuth: true
    });


  }
]);
