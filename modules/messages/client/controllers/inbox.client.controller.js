(function () {
  angular
    .module('messages')
    .controller('InboxController', InboxController);

  /* @ngInject */
  function InboxController($rootScope, $state, $analytics, Authentication, Messages, $log) {

    // ViewModel
    var vm = this;

    // Exposed to the view
    vm.threads = [];
    vm.messageHandler = new Messages();
    vm.moreMessages = moreMessages;
    vm.otherParticipant = otherParticipant;
    vm.openThread = openThread;

    // Fetches first page of messages
    vm.messageHandler.fetchMessages().$promise
      .then(function (data) {
        addMessages(data);
      }, function () {
        $log.warn('Could not fetch messages.');
      });

    activate();

    function activate() {
      // Tell unread-messages directive to sync itself
      $rootScope.$broadcast('syncUnreadMessagesCount');
    }

    // Appends returned messages to model
    function addMessages(data) {
      angular.forEach(data, function (msg) {
        vm.threads.unshift(msg);
      });
    }

    /**
     * Gets next page of messages
     * Activates when the last thread element hits the bottom view port
     */
    function moreMessages(waypointsDown) {
      if (vm.messageHandler.nextPage && waypointsDown) {
        vm.messageHandler.fetchMessages().$promise.then(function (data) {
          addMessages(data);
        });

        $analytics.eventTrack('inbox-pagination', {
          category: 'messages.inbox',
          label: 'Inbox page ' + vm.messageHandler.nextPage
        });
      }
    }

    /**
     * Solve which of two thread participants is "the other", not logged in user
     * This is needed since thread handle has two fields for users 'userTo' and 'userFrom'
     * and either one can be 'the other', depending who replied the latest.
     *
     * Return either displayName or user object
     */
    function otherParticipant(thread, value) {
      var other = (thread.userFrom && thread.userFrom._id === Authentication.user._id) ? thread.userTo : thread.userFrom;

      if (!other) {
        return;
      }

      if (value && value === 'displayName') {
        return other.displayName;
      } else if (value && value === 'username') {
        return other.username;
      } else {
        // User object
        return other;
      }
    }

    /*
     * Open thread
     */
    function openThread(user) {
      if (angular.isDefined(user.username)) {
        $state.go('messageThread', { username: user.username });
      }
    }

  }
}());
