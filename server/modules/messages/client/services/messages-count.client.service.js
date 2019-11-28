(function () {
  // MessagesCount service used for communicating with the messages REST endpoints
  angular
    .module('messages')
    .factory('MessagesCount', MessagesCount);

  /* @ngInject */
  function MessagesCount($resource) {
    return $resource('/api/messages-count');
  }
}());
