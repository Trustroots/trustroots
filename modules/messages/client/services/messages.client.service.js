'use strict';

//Messages service used for communicating with the messages REST endpoints
angular.module('messages').factory('Messages', ['$resource',
  function($resource) {
    return $resource('/api/messages/:userId', {
      userId: '@_id'
    }, {
      update: {
        method: 'PUT'
      }
    });
  }
]);

angular.module('messages').factory('MessagesRead', ['$resource',
  function($resource) {
    return $resource('/api/messages-read', {
      messageIds: '@messageIds'
    }, {
      query: {
        method: 'POST',
        isArray: false,
        cache: false
      }
    });
  }
]);
