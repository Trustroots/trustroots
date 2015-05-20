'use strict';

// Contacts service used for communicating with the contacts REST endpoints

// Read contact list by userId
angular.module('contacts').factory('ContactList', ['$resource',
  function($resource) {
    return $resource('/api/contacts/:listUserId', {
      listUserId: '@id'
    });
  }
]);

// Read contact by userId
angular.module('contacts').factory('ContactBy', ['$resource',
  function($resource) {
    return $resource('/api/contact-by/:userId', {
      userId: '@id'
    }, {
      get: {
        method: 'GET'
      }
    });
  }
]);

// Read contact by contactId
angular.module('contacts').factory('Contact', ['$resource',
  function($resource) {
    return $resource('/api/contact/:contactId', {
      contactId: '@_id'
    }, {
      get: {
        method: 'GET'
      },
      update: {
        method: 'PUT'
      },
      delete: {
        method: 'DELETE'
      }
    });
  }
]);
