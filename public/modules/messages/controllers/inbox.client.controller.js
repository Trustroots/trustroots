'use strict';

angular.module('messages').controller('MessagesInboxController', ['$scope', '$state', '$log', 'Authentication', 'Messages', 'messageCenterService', //, 'Socket'
  function($scope, $state, $log, Authentication, Messages, messageCenterService) {//, Socket

    $scope.user = Authentication.user;

    $scope.threads =[];
    $scope.messageHandler = new Messages;

    /*
    Socket.on('message.thread', function(thread) {
        $log.log('->refresh inbox');
        $scope.findInbox();
    });
    */

    // Appends returned messages to model
    function addMessages(data){
      angular.forEach(data, function(msg){
        $scope.threads.unshift(msg);
      })
    }

    // Fetches first page of messages
    $scope.messageHandler.fetchMessages().$promise.then(function(data){
      addMessages(data);
    });

    /**
     * Gets next page of messages
     * Activates when the last thread element hits the bottom view port
     */
    $scope.moreMessages = function(waypoints){
      if($scope.messageHandler.nextPage && waypoints) {
        $scope.messageHandler.fetchMessages().$promise.then( function (data) {
          addMessages(data);
        },
        //Flashes error message if it failed to get messages
        function(err){
          messageCenterService.add('danger', 'Something went wrong :(', {timeout: flashTimeout});
        }
        );
      }
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
