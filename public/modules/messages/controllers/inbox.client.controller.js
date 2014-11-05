'use strict';

angular.module('messages').controller('MessagesInboxController', ['$scope', '$state', '$log', 'Socket', 'Authentication', 'Messages',
  function($scope, $state, $log, Socket, Authentication, Messages) {
    $scope.authentication = Authentication;

    Socket.on('message.thread', function(thread) {
        $log.log('->refresh inbox');
        $scope.findInbox();
    });

    $scope.findInbox = function() {
      $scope.threads = Messages.query();
    };

    /**
     * Solve which of two thread participants is "the other", not logged in user
     * This is needed since thread handle has two fields for users 'userTo' and 'userFrom'
     * and either one can be 'the other', depending who replied the latest.
     *
     * Return either displayName or user object
     */
    $scope.otherParticipant = function(thread, value) {

      var other = (thread.userFrom._id === $scope.authentication.user._id) ? thread.userTo : thread.userFrom;

      if (value === 'displayName') {
        return other.displayName;
      }
      else if (value === 'id') {
        return other._id;
      }
      else {
        // User object
        return other;
      }

    };

    /**
     * Open thread
     */
    $scope.openThread = function(thread) {
      $state.go('listMessages', { userId: $scope.otherParticipant(thread, 'id') });
    };

  }
]);
