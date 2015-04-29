'use strict';

/* This declares to JSHint that these are global variables: */
/*global flashTimeout:false */

angular.module('messages').controller('MessagesThreadController', ['$scope', '$stateParams', '$state', '$document', '$window', '$anchorScroll', '$timeout', 'Authentication', 'Messages', 'MessagesRead', 'messageCenterService', //'Socket',
  function($scope, $stateParams, $state, $document, $window, $anchorScroll, $timeout, Authentication, Messages, MessagesRead, messageCenterService) {//, Socket

    // If no recepient defined, go to inbox
    if (!$stateParams.userId) $state.go('inboxMessages');

    // Vars
    $scope.user = Authentication.user;
    $scope.userToId = $stateParams.userId;
    $scope.isSending = false;
    var flaggedAsRead = [];

    // No sending messages to yourself
    if ($scope.user._id === $scope.userToId) $state.go('inboxMessages');

    // Fetch messages for this thread
    $scope.messages = Messages.query({
      userId: $stateParams.userId
    }, function(){
      // Keep layout in good order
      threadLayout();
    });


    /**
     * Calculate thread etc layout locations with this massive pile of helpers
     */
    var threadLayoutContainer = angular.element('#thread-container'),
        threadLayoutThread = angular.element('#messages-thread'),
        threadLayoutReply = angular.element('#message-reply');

    // Add (or reset) timeout to not call the resizing function every pixel
    var threadLayoutUpdateTimeout;
    function threadLayoutUpdate() {
      $timeout.cancel(threadLayoutUpdateTimeout);
      threadLayoutUpdateTimeout = $timeout(threadLayout, 300);
    }

    // Keep thread in good condition when screen resizes/orientation changes/message textrea grows
    // This sorta should be at .less files, but the message thread is such an complicated peace of UI...
    // Mostly this is needed due growing text field
    function threadLayout() {

      $scope.replyHeight = threadLayoutReply.height() + 'px';

      // container has 15px padding on both sides when window is bigger than screen-sm-max (768px)
      var containerPadding = ($window.innerWidth < 768) ? -15 : 30;
      $scope.containerWidth = threadLayoutContainer.width() - containerPadding + 'px';
      $scope.replyWidth = threadLayoutContainer.width() - 30 + 'px';
    }

    // Add (or reset) timeout to not call the scrolling function every key stroke
    var threadScrollUpdateTimeout;
    function threadScrollUpdate() {
      $timeout.cancel(threadScrollUpdateTimeout);
      threadScrollUpdateTimeout = $timeout(threadScrollBottom, 300);
    }

    // Scroll thread to bottom to show latest messages
    function threadScrollBottom() {
      threadLayoutThread.scrollTop(threadLayoutThread[0].scrollHeight);
    }

    // Keep layout in good order with these listeners
    angular.element($window).on('resize', threadLayoutUpdate);
    angular.element($window).bind('orientationchange', threadLayoutUpdate);
    angular.element($window).bind('orientationchange', threadScrollBottom);

    // Fire html.resize() so that jQuery-Waypoints can check what's visible on the screen and mark visible messages read.
    var onScrollTimeout,
        html = angular.element('html');
    threadLayoutThread.bind('scroll', function() {
        if(onScrollTimeout) $timeout.cancel(onScrollTimeout);
        onScrollTimeout = $timeout(function(){ html.resize(); }, 300);
    });

    $scope.$on('$stateChangeSuccess', function(event, toState, toParams, fromState, fromParams) {
      threadLayoutUpdate();
      $timeout(threadScrollBottom, 500);
      $timeout(threadScrollBottom, 1500);
      $timeout(threadScrollBottom, 2500);
    });

    // Observe for the reply area height while typing your awesome message in it
    angular.element('#message-reply-content').on('input', function() {
      $scope.replyHeight = threadLayoutReply.height() + 15 + 'px';
      threadScrollUpdate();
    });


    /**
     * Send messages marked as read (at frontend) to the backend
     * Has 1s timeout to slow down continuous pinging of the API
     */
    var syncReadTimer;
    function activateSyncRead() {
      // Cancel previously set timer
      if(syncReadTimer) $timeout.cancel(syncReadTimer);
      // syncRead happens with 1s delay
      // (and gets postponed by 1s if new activateSyncRead() happens)
      if(flaggedAsRead.length > 0) {
        syncReadTimer = $timeout(syncRead, 1000);
      }
    }
    function syncRead() {
      MessagesRead.query({
        messageIds: flaggedAsRead
      }, function(response){
        flaggedAsRead = [];
      });
    }


    /**
     * Mark message read at the frontend
     * This function inits each time message div passes viewport
     * Read message id is stored at array which will be sent to backend and emptied
     *
     * @todo: kill observer after message is marked read
     */
    $scope.messageRead = function(message, scrollingUp, scrollingDown) {

      // It was read earlier
      if(message.read === true) return true;

      // Own messages are always read
      if(message.userFrom._id === $scope.user._id) return true;

      // It got marked read just now
      var read = (scrollingUp === true || scrollingDown === true);
      if(message.userFrom._id !== Authentication.user._id && !message.read && read) {
        message.read = true;
        flaggedAsRead.push(message._id);
        activateSyncRead();
      }

      return read;
    };


    /**
     * Send a message
     */
    $scope.send = function() {
      $scope.isSending = true;

      if(this.content === '<p><br></p>' || this.content.trim() === '') {
        $scope.isSending = false;
        messageCenterService.add('warning', 'Write a message first...', { timeout: flashTimeout });
        return;
      }

      var message = new Messages({
        content: this.content,
        userTo: $stateParams.userId,
        read: false
      });

      message.$save(function(response) {

        $scope.content = '';
        $scope.isSending = false;

        // Emit a 'chatMessage' message event
        //Socket.emit('message.sent', message);

        // Remove this when socket is back!
        $scope.messages.unshift(response);
        $timeout(threadScrollBottom, 300);

      }, function(errorResponse) {
        $scope.isSending = false;
        // Show alert
        messageCenterService.add('danger', errorResponse.data.message, { timeout: flashTimeout });
      });

    };


    /**
     * Listen to received/sent messages and add them to our model
     */
     /*
    Socket.on('message.sent', function(message) {
      message.pushed = true; // flag as pushed
      //$scope.messages.push(message);
      $scope.messages.unshift(message);
      $timeout(threadScrollBottom, 300);
    });
    // Remove the event listener when the controller instance is destroyed
    $scope.$on('$destroy', function() {
      Socket.removeListener('message.sent');
    });
    */

  }
]);
