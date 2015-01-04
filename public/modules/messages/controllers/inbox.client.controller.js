'use strict';

angular.module('messages').controller('MessagesInboxController', ['$scope', '$state', '$log', 'Authentication', 'Messages',//, 'Socket'
  function($scope, $state, $log, Authentication, Messages) {//, Socket

    // If user is not signed in then redirect back home
    if (!Authentication.user) $state.go('home');

    $scope.user = Authentication.user;

    /*
    Socket.on('message.thread', function(thread) {
        $log.log('->refresh inbox');
        $scope.findInbox();
    });
    */

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

      // $scope.user holds currently authenticated user
      var other = (thread.userFrom._id === $scope.user._id) ? thread.userTo : thread.userFrom;

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
