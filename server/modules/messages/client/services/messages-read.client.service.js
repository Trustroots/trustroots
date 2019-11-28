(function () {
  // MessagesRead service used for communicating with the messages REST endpoints
  angular
    .module('messages')
    .factory('MessagesRead', MessagesRead);

  /* @ngInject */
  function MessagesRead($resource) {
    return $resource('/api/messages-read', {
      messageIds: '@messageIds'
    }, {
      query: {
        method: 'POST',
        isArray: false,
        cache: false,
        ignoreLoadingBar: true
      }
    });
  }
}());
