'use strict';

angular.module('messages').controller('MessagesThreadController', ['$scope', '$stateParams', '$state', '$document', '$window', '$anchorScroll', '$timeout', 'Socket', 'Authentication', 'Messages', 'MessagesRead',
  function($scope, $stateParams, $state, $document, $window, $anchorScroll, $timeout, Socket, Authentication, Messages, MessagesRead) {
    $scope.authentication = Authentication;

    // If user is not signed in then redirect back home
    if (!$scope.authentication.user) $state.go('home');

    // If no recepient defined, go to inbox
    if (!$stateParams.userId) $state.go('inboxMessages');

    $scope.userToId = $stateParams.userId;

    $scope.isThreadLoading = false;
    $scope.isSending = false;

    /**
     * Calculate thread etc layout locations with this massive pile of helpers
     */
    var threadLayoutContainer = angular.element('#thread-container'),
        threadLayoutThread = angular.element('#messages-thread'),
        threadLayoutReply = angular.element('#message-reply');

    // Add (or reset) timeout to not call the resizing function every pixel
    $scope.threadLayoutUpdate = function() {
      $timeout.cancel($scope.threadLayoutUpdateTimeout);
      $scope.threadLayoutUpdateTimeout = $timeout($scope.threadLayout, 300);
    };

    $scope.threadLayout = function() {
      $scope.replyHeight = threadLayoutReply.height() + 15 + 'px'; // container has 15px padding on both sides
      $scope.containerWidth = threadLayoutContainer.width() - 30 + 'px'; // reply area has 15px padding at bottom
    };

    // Add (or reset) timeout to not call the scrolling function every key stroke
    $scope.threadScrollUpdate = function() {
      $timeout.cancel($scope.threadScrollUpdateTimeout);
      $scope.threadScrollUpdateTimeout = $timeout($scope.threadScroll, 300);
    };

    // Scroll thread to bottom to show latest messages
    $scope.threadScroll = function() {
      threadLayoutThread.scrollTop( threadLayoutThread[0].scrollHeight );
      threadLayoutThread.perfectScrollbar('update');
    };

    // Keep layout in good order with these listeners
    angular.element($window).on('resize', $scope.threadLayoutUpdate);
    angular.element($window).bind('orientationchange', $scope.threadLayoutUpdate);
    $scope.$on('$stateChangeSuccess', function(event, toState, toParams, fromState, fromParams) {
      $scope.threadLayoutUpdate();
      $timeout($scope.threadScroll, 300);
    });

    // Observe for the reply area height while typing your awesome message in it
    angular.element('#message-reply-content').on('input', function() {
      $scope.replyHeight = threadLayoutReply.height() + 15 + 'px';
      $scope.threadScrollUpdate();
    });

    /*
     * "perfect-scrollbar" directive somehow eats all native scroll events,
     * so that "zum-waypoint" directive can't see them anymore and won't update
     * read status of messages. Shooting resize() into html element solves this.
     * onScroll() is bind to perfect-scrollbar's event.
     * There's a small buffer so that resize() would not be shot on each scroll event.
     *
     * ...so yeah, this is hacky. ;-)
     */
    var html = angular.element('html');
    $scope.onScroll = function(scrollTop, scrollHeight) {
      $timeout.cancel($scope.onScrollTimeout);
      $scope.onScrollTimeout = $timeout(function(){ html.resize(); }, 300);
    };


    // Temporary storage for messages marked as read at frontend, to be sent to the backend
    $scope.flaggedAsRead = [];

    /**
     * Send messages marked as read (at frontend) to the backend
     * Has 1s timeout to slow down continuous pinging of the API
     */
    $scope.activateSyncRead = function() {

      $timeout.cancel($scope.syncReadTimer);

      if($scope.flaggedAsRead.length > 0) {
        $scope.syncReadTimer = $timeout($scope.syncRead, 1000);
      }

    };
    $scope.syncRead = function() {
      MessagesRead.query({
        messageIds: $scope.flaggedAsRead
      }, function(response){
        $scope.flaggedAsRead = [];
      });
    };


    /**
     * Mark message read at the frontend
     * This function inits each time message div passes viewport
     * Read message id is stored at array which will be sent to backend and emptied
     *
     * @todo: kill observer after message is marked read
     */
    $scope.messageRead = function(message, scrollingUp, scrollingDown) {
        var read = (scrollingUp === true || scrollingDown === true);

        if(message.userFrom._id !== Authentication.user._id && !message.read && read) {
          message.read = true;
          $scope.flaggedAsRead.push(message._id);
          $scope.activateSyncRead();
        }

        return read;
    };


    /**
     * Send a message
     */
    $scope.send = function() {
      $scope.isSending = true;

      var message = new Messages({
        content: this.content,
        userTo: $stateParams.userId,
        read: false
      });

      message.$save(function(response) {
        $scope.content = '';
        $scope.isSending = false;
      }, function(errorResponse) {
        $scope.isSending = false;
        $scope.error = errorResponse.data.message;
      });

    };

    /**
     * Listen to received/sent messages and add them to our model
     */
    Socket.on('message.sent', function(message) {
      message.pushed = true; // flag as pushed
      $scope.messages.push(message);
      $timeout($scope.threadScroll, 300);
    });

    // Remove the event listener when the controller instance is destroyed
    $scope.$on('$destroy', function() {
      Socket.removeListener('message.sent');
    });


    /**
     * Load messages for this thread
     */
    $scope.findThread = function() {

      $scope.isThreadLoading = true;

      $scope.messages = Messages.query({
        userId: $stateParams.userId
      }, function(){
        $scope.isThreadLoading = false;

        // Keep layout in good order
        $scope.threadLayout();
      });

    };

  }
]);
