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
  function MessagesThreadController($scope, $q, $stateParams, $state, $document, $window, $anchorScroll, $timeout, Authentication, Messages, MessagesRead, messageCenterService, locker, appSettings, userTo, cfpLoadingBar) {

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
        messageIdsInView = [],
        editorContentChangedTimeout;

    // Make cache id unique for this user
    var cachePrefix = 'messages.thread.' + Authentication.user._id + '-' + $stateParams.username;

    // View model
    var vm = this;

    // Exposed to the view
    vm.userFrom = Authentication.user;
    vm.userTo = userTo;
    vm.isSending = false;
    vm.isInitialized = false;
    vm.messages = [];
    vm.messageHandler = new Messages();
    vm.profileDescriptionLength = Authentication.user.description ? plainTextLength(Authentication.user.description) : 0;
    vm.sendMessage = sendMessage;
    vm.moreMessages = moreMessages;
    vm.messageRead = messageRead;
    vm.editorContentChanged = editorContentChanged;
    vm.plainTextLength = plainTextLength;
    vm.content = '';

    activate();

    /**
     * Initialize controller
     */
    function activate() {

      /**
       * Is local/sessionStorage supported? This might fail in browser's incognito mode
       *
       * If it is, unfinished messages are cached to SessionStorage
       * Check for a previously saved message here
       *
       * See also sendMessage(), where message is clared
       */
      if(locker.supported()) {
        // Get message from cache, use default if it doesn't exist
        vm.content = locker.driver('session').get(cachePrefix, '');
      }

      // Fetches first page of messages after receiving user has finished loading (we need the userId from there)
      userTo.$promise.then(function() {

          fetchMessages().$promise.then(function(data) {

            addMessages(data);
            vm.isInitialized = true;

            // Timeout makes sure thread-dimensions-directive has finished loading
            // and there would thus be something actually listening to these broadcasts:
            $timeout(function() {
              $scope.$broadcast('threadRefreshLayout');
              if(data.length > 0) {
                $scope.$broadcast('threadScrollToBottom');
              }
            });

          });
      },
      // No user...
      function(error) {
        // User not found:
        if(error.status === 404) {
          vm.isInitialized = true;
        }
        // Unexpected errors:
        else {
          messageCenterService.add('warning', error.message || 'Cannot load messages. Please refresh the page and try again.', { timeout: 20000 });
        }
      });

    }

    /**
     * When contents at the editor change, update layout
     */
    function editorContentChanged() {
      // Add (or reset) timeout to prevent calling this too often
      $timeout.cancel(editorContentChangedTimeout);
      editorContentChangedTimeout = $timeout(refreshAndScrollToBottom, 300);
    }

    /**
     * Call underlaying thread-dimensions directive to update+scroll
     */
    function refreshAndScrollToBottom() {
      $scope.$broadcast('threadRefreshLayout');
      $scope.$broadcast('threadScrollToBottom');

      // Save message to a cache (see sendMessage() where it's emptiet and vm-list for the getter)
      locker.driver('session').put(cachePrefix, vm.content);
    }

    /**
     * Attach userID for backend calls
     */
    function fetchMessages() {
      return (
        vm.messageHandler.fetchMessages({
          userId: userTo._id
        })
      );
    }


    /**
     * Return length of a string without html
     * Very crude html stripping, which is enough for estimating if text is short/empty without html tags
     */
    function plainTextLength(text) {
      return text ? String(text).replace(/&nbsp;/g, ' ').replace(/<[^>]+>/gm, '').trim().length : 0;
    }

    /**
     * Appends returned messages to model
     */
    function addMessages(data) {
      var messages = [];

      // Loop trough received data (for loop is the fastest)
      for (var i = 0; i < data.length; i++) {

        // Check if message by this ID doesn't exist yet
        // messageIdsInView is used as a key storage for quick reference of messages already in view
        if(messageIdsInView.indexOf(data[i]._id) === -1) {
          messageIdsInView.push(data[i]._id);
          vm.messages.push(data[i]);
        }
      }

      // Finally refresh the layout
      $timeout(function() {
        $scope.$broadcast('threadRefreshLayout');
      });

    }

    /**
     * Gets next page of messages
     * Activates when the first(top most) message hits the top viewport
     */
    function moreMessages() {
      if(vm.messageHandler.nextPage && !vm.messageHandler.paginationTimeout) {

        if(!elemThread) elemThread = angular.element('#messages-thread');

        var oldHeight = elemThread[0].scrollHeight;

        fetchMessages().$promise.then(function(data) {
          addMessages(data);
          setScrollPosition(oldHeight);
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
     * @todo: having this as a function is a performance issue
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

      // Make sure the message isn't empty.
      // Sometimes we'll have some empty blocks due wysiwyg
      if(plainTextLength(vm.content) === 0) {
        vm.isSending = false;
        messageCenterService.add('warning', 'Please write a message first...');
        return;
      }

      var message = new vm.messageHandler.ajaxCall({
        content: vm.content,
        userTo: userTo._id,
        read: false
      });

      message.$save(function(response) {

        vm.content = '';
        vm.isSending = false;

        // Remove message from cache
        locker.driver('session').forget(cachePrefix);

        // Remove this when socket is back!
        vm.messages.unshift(response);

        // $timeout ensures scroll happens only after DOM has finished rendering
        $timeout(function() {
          $scope.$broadcast('threadScrollToBottom');
        });

      }, function(errorResponse) {
        vm.isSending = false;
        messageCenterService.add('danger', errorResponse.data.message || 'Couldn not send the message. Please try again.');
      });
    }

  }

})();
