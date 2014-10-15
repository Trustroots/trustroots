'use strict';

angular.module('messages').controller('MessagesThreadController', ['$scope', '$stateParams', '$log', '$state', '$document', '$window', '$anchorScroll', '$timeout', 'Socket', 'Authentication', 'Messages', 'UsersMini',
	function($scope, $stateParams, $log, $state, $document, $window, $anchorScroll, $timeout, Socket, Authentication, Messages, UsersMini) {
		$scope.authentication = Authentication;

		// If user is not signed in then redirect back home
		if (!$scope.authentication.user) $state.go('home');

		// If no recepient defined, go to inbox
		if (!$stateParams.userId) $state.go('inboxMessages');

    // Mini profile of receiving user for monkeybox
    $scope.userTo = UsersMini.get({ userId: $stateParams.userId });

    $scope.isThreadLoading = false;
    $scope.isSending = false;


    /**
     * Calculate thread etc locations with this massive pile of helpers
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
        $log.log('->threadScroll');
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


    /**
     * Send a message
     */
		$scope.send = function() {
		  $scope.isSending = true;

		  var message = new Messages({
		    content: this.content,
		    userTo: $stateParams.userId
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
