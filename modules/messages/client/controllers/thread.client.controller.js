(function() {
  'use strict';

/*
 * checklist:
 * - scope init variable - needed?
 * - scaffolding order
 * - directive scaffolding ord.
 * - check $apply and $timeout order
 * - check if vm.isInitialized should come much later?
 */

  angular
    .module('messages')
    .controller('MessagesThreadController', MessagesThreadController);

  /* @ngInject */
  function MessagesThreadController($scope, $q, $stateParams, $state, $document, $window, $anchorScroll, $timeout, Authentication, Messages, MessagesRead, messageCenterService, localStorageService, appSettings, userTo) {

    // Go back to inbox on these cases
    // - No recepient defined
    // - Not signed in
    // - Sending messages to yourself
    if(!$stateParams.username || !Authentication.user || Authentication.user._id === userTo._id) {
      $state.go('inbox');
    }

    // Vars
    var elemThread,
        syncReadTimer,
        flaggedAsRead = [],
        contentCacheId = 'thread-' + $stateParams.username;

    // View model
    var vm = this;

    // Exposed to the view
    vm.userFrom = Authentication.user;
    vm.userTo = userTo;
    vm.isSending = false;
    vm.isInitialized = false;
    vm.messages = [];
    vm.messageHandler = new Messages();
    vm.sendMessage = sendMessage;
    vm.moreMessages = moreMessages;
    vm.messageRead = messageRead;


    /**
     * Unfinished messages are cached to SessionStorage
     * Check for a previously saved message here
     *
     * SessionStorage (instead of LocalStorage) is defined to be used at app init config
     * See also sendMessage(), where message is clared with remove()
     */
    vm.content = localStorageService.get(contentCacheId) || '';

    initController();

    /**
     * Attach userID for backend calls
     */
    var fetchMessages = function() {
      return (
        vm.messageHandler.fetchMessages({
          userId: userTo._id
        })
      );
    };

    /**
     * Appends returned messages to model
     */
    function addMessages(data) {
      var messages = [];
      angular.forEach(data, function(msg) {
        messages.push(msg);
      });

      $timeout(function() {
        angular.extend(vm.messages, messages);
        $timeout(function() {
          vm.isInitialized = true;
          $scope.$broadcast('threadRefreshLayout');
        });
      });
    }

    /**
     * Gets next page of messages
     * Activates when the first(top most) message hits the top viewport
     */
    function moreMessages() {
      if(vm.messageHandler.nextPage) {

        if(!elemThread) elemThread = angular.element('#messages-thread');

        var oldHeight = elemThread[0].scrollHeight;

        fetchMessages().$promise.then(function(data) {
          setScrollPosition(oldHeight);
          addMessages(data);
        });
      }
    }

    /**
     * Restores scroll position after pagination
     * Timeout is in place to force function to execute after digest cycle to properly calculate scroll height.
     */
    function setScrollPosition(oldHeight) {
      $timeout(function() {
        var newHeight = elemThread[0].scrollHeight;
        angular.element(elemThread.scrollTop(newHeight - oldHeight));
      });
    }


    //$scope.$on('$stateChangeSuccess', function() {
    function initController() {
    $timeout(function(){
      // Fetches first page of messages
      fetchMessages().$promise.then( function(data) {

        addMessages(data);

        //vm.isInitialized = true;

        // Timeout makes sure thread-dimensions-directive has finished loading
        // and there would thus be something actually listening to these:
        $timeout(function() {
          $scope.$broadcast('threadRefreshLayout');
          if(data.length > 0) {
            $scope.$broadcast('threadScrollToBottom');
          }
        });


      });
    });
    }


    /**
     * Send messages marked as read (at frontend) to the backend
     * Has 1s timeout to slow down continuous pinging of the API
     */
    function activateSyncRead() {
      // Cancel previously set timer
      if(syncReadTimer) $timeout.cancel(syncReadTimer);
      // syncRead happens with 1s delay
      // (and gets postponed by 1s if new activateSyncRead() happens)
      if(flaggedAsRead.length > 0) {
        syncReadTimer = $timeout(syncRead, 1000);
      }
    }

    /**
     * Send messages marked at read to the API and then empty buffer
     */
    function syncRead() {
      MessagesRead.query({
        messageIds: flaggedAsRead
      }, function(response) {
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
    function messageRead(message, scrollingUp, scrollingDown) {

      // It was read earlier
      if(message.read === true) return true;

      // Own messages are always read
      if(message.userFrom._id === Authentication.user._id) return true;

      // It got marked read just now
      var read = (scrollingUp === true || scrollingDown === true);
      if(message.userFrom._id !== Authentication.user._id && !message.read && read) {
        message.read = true;
        flaggedAsRead.push(message._id);
        activateSyncRead();
      }

      return read;
    }


    /**
     * Send a message
     */
    function sendMessage() {
      vm.isSending = true;

      if(vm.content === '<p><br></p>' || vm.content.trim() === '') {
        vm.isSending = false;
        messageCenterService.add('warning', 'Write a message first...', { timeout: appSettings.flashTimeout });
        return;
      }

      var message = new vm.messageHandler.ajaxCall({
        content: vm.content,
        userTo: userTo._id,
        read: false
      });

      message.$save(function(response) {

        // Remove cached message
        //localStorageService.remove(contentCacheId);

        vm.content = '';
        vm.isSending = false;

        // Remove this when socket is back!
        vm.messages.unshift(response);

        // $timeout ensures scroll happens only after DOM has finished rendering
        $timeout(function() {
          $scope.$broadcast('threadScrollToBottom');
        });

      }, function(errorResponse) {
        vm.isSending = false;
        messageCenterService.add('danger', errorResponse.data.message, { timeout: appSettings.flashTimeout });
      });
    }

    /**
     * Textarea keypress listener (could be also .on('input') but this seems to be working better for mobile)
     * - Pressing Ctrl+Enter at message field sends the message
     * - Save message to a cache (see sendMessage() where it's emptiet and vm-list for the getter)
     */
    angular.element('#message-reply-content').on('keypress', function(event) {
      if(event.ctrlKey && event.charCode === 10) {
        sendMessage();
      }
      else {
        localStorageService.set(contentCacheId, vm.content);
      }
    });

  }

})();
