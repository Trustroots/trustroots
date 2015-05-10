'use strict';

/* This declares to JSHint that these are global variables: */
/*global flashTimeout:false */

angular.module('messages').controller('MessagesThreadController', ['$scope', '$stateParams', '$state', '$document', '$window', '$anchorScroll', '$timeout', 'Authentication', 'Messages', 'MessagesRead', 'messageCenterService', '$q', //'Socket',
  function($scope, $stateParams, $state, $document, $window, $anchorScroll, $timeout, Authentication, Messages, MessagesRead, messageCenterService, $q) {//, Socket

    // If no recepient defined, go to inbox
    if (!$stateParams.userId) $state.go('inboxMessages');

    // Vars
    $scope.user = Authentication.user;
    $scope.userToId = $stateParams.userId;
    $scope.isSending = false;
    $scope.messages = [];
    var flaggedAsRead = [];
    var previousPage = '';
    //Variable for flow control
    var paginationTimer;

    // No sending messages to yourself
    if ($scope.user._id === $scope.userToId) $state.go('inboxMessages');

    //Parse link header for pagination parameters.
    function parseHeaders(header){
      if(header){
        return {
          page: /<.*\/[^<>]*\?.*page=(\d*).*>;.*/.exec(header)[1],
          limit: /<.*\/[^<>]*\?.*limit=(\d*).*>;.*/.exec(header)[1]
        };
      }
      else {return header;}
    }

    /**
     * Fetches messages and sets up pagination environment
     * Takes additional query params passed in as key , value pairs
     */
    $scope.fetchMessages = function(param){
      var deferred = $q.defer();
      var query = {userId: $stateParams.userId};
      if (param) {angular.extend(query,param);}

      Messages.query(
        query,
        //Successful call
        function(results,headers){
          angular.forEach(results, function(data){$scope.messages.unshift(data);});
          $scope.nextPage = parseHeaders(headers().link);
          $scope.fetchMessages.resolved = true;
          paginationTimer = false;

          // Keep layout in good order
          threadLayout();
          deferred.resolve();
        },
        //Rejected call
        function(){
          $scope.fetchMessages.resolved = 'reject';
          paginationTimer = false;
          deferred.reject();
        }
      );
      return deferred.promise;
    };

    /**
     * Fetches next page of messages
     * Activates when the first (top most) message element hits the top view port
     */
    $scope.moreMessages = function(waypoint){
      if($scope.nextPage !== previousPage && waypoint && !paginationTimer){
          var oldHeight = threadLayoutThread[0].scrollHeight;

          //Calls for next page and sets scroll position when results return
          paginationTimer = $scope.fetchMessages($scope.nextPage)
            .then(function(){
                setScrollPosition(oldHeight);
            });
      }
    };

    /**
     * Restores scroll position after pagination
     * Timeout is in place to force function to execute after digest cycle to properly calculate scroll height.
     */
    function setScrollPosition(oldHeight) {
      $timeout(function () {
        var newHeight = threadLayoutThread[0].scrollHeight;
        angular.element(threadLayoutThread.scrollTop(newHeight - oldHeight));
      });
    }

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
      if(message.read === true) return true;

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
