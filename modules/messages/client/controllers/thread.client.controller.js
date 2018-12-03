(function () {
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
  function MessagesThreadController($rootScope, $scope, $stateParams, $state, $timeout, $filter, $analytics, Authentication, Messages, MessagesRead, messageCenterService, locker, userTo) {

    // Go back to inbox on these cases
    // - No recepient defined
    // - Not signed in
    // - Sending messages to yourself
    if (!$stateParams.username || !Authentication.user || Authentication.user._id === userTo._id) {
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
    vm.isQuickReplyPanelHidden = true;
    vm.messages = [];
    vm.messageHandler = new Messages();
    vm.profileDescriptionLength = Authentication.user.description ? $filter('plainTextLength')(Authentication.user.description) : 0;
    vm.sendMessage = sendMessage;
    vm.moreMessages = moreMessages;
    vm.messageRead = messageRead;
    vm.focusToWriting = focusToWriting;
    vm.sendHostingReply = sendHostingReply;
    vm.hostingReplyStatus = hostingReplyStatus;
    vm.editorContentChanged = editorContentChanged;
    vm.content = '';

    activate();

    /**
     * Initialize controller
     */
    function activate() {
      // Tell unread-messages directive to sync itself
      $rootScope.$broadcast('syncUnreadMessagesCount');

      /**
       * Is local/sessionStorage supported? This might fail in browser's incognito mode
       *
       * If it is, unfinished messages are cached to SessionStorage
       * Check for a previously saved message here
       *
       * See also sendMessage(), where message is clared
       */
      if (locker.supported()) {
        // Get message from cache, use default if it doesn't exist
        vm.content = locker.driver('session').get(cachePrefix, '');
      }

      // Fetches first page of messages after receiving user has finished loading (we need the userId from there)
      userTo.$promise.then(function () {
        fetchMessages().$promise.then(function (data) {

          addMessages(data);
          vm.isInitialized = true;

          if (data.length > 0) {
            var userReplied = checkAuthUserReplied(data);
            if (!userReplied) {
              vm.isQuickReplyPanelHidden = false;
            }
          }

          // Timeout makes sure thread-dimensions-directive has finished loading
          // and there would thus be something actually listening to these broadcasts:
          $timeout(function () {
            $scope.$broadcast('threadRefreshLayout');
            if (data.length > 0) {
              $scope.$broadcast('threadScrollToBottom');
            }
          });

        });
      },
      // No user...
      function (error) {
        // User not found...
        if (error.status === 404) {
          vm.isInitialized = true;
        // Other Unexpected errors...
        } else {
          messageCenterService.add('warning', error.message || 'Cannot load messages. Please refresh the page and try again.', { timeout: 20000 });
        }
      });

    }

    /**
     * Sends a predefined quickreply
     *
     * @param {String} reply - 'yes' for positive, 'no' for negative
     */
    function sendHostingReply(reply) {
      vm.isQuickReplyPanelHidden = true;

      var quickReplyMessage;

      if (reply === 'yes') {
        quickReplyMessage = 'Yes, I can host!';
      } else {
        quickReplyMessage = 'Sorry, I can\'t host';
      }

      // Send a normal message with predefined content
      sendMessage(
        // This attribute must be whitelisted in `sanitizeOptions` at
        // `modules/core/server/services/text.server.service.js`
        '<p data-hosting="' + reply + '">' +
          '<b><i>' +
            quickReplyMessage +
          '</i></b>' +
        '</p>'
      );

      $analytics.eventTrack('messages.hostingreply.' + reply, {
        category: 'messages.hostingreply',
        label: 'Message hosting hosting reply "' + reply + '"'
      });
    }

    /**
     * Set focus to message textfield and hide quickreply buttons
     */
    function focusToWriting() {
      vm.isQuickReplyPanelHidden = true;
      angular.element('#message-reply-content').focus();
    }

    /**
     * Used to determine if message contains hosting request reply
     *
     * @param {String} messageContent - Message to be analysed
     * @returns {String} - 'unknown' if it doesn't, 'yes' if it does and reply is positive, 'no' if it does and reply is negative
     */
    function hostingReplyStatus(messageContent) {

      // Message has a hosting request reply and it's positive
      if (messageContent.substr(0, 21) === '<p data-hosting=\"yes\"') {
        return 'yes';
      }

      // Message has a hosting request reply and it's negative
      if (messageContent.substr(0, 20) === '<p data-hosting=\"no\"') {
        return 'no';
      }

      // Message doesn't have hosting request reply
      return 'unknown';
    }

    /**
    *
    * Check if Authenticated Receiver Replied to a request
    */
    function checkAuthUserReplied(data) {
      for (var i = 0; i < data.length; i++) {
        if (Authentication.user._id === data[i].userFrom._id) {
          return true;
        }
      }
      return false;
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
      if (locker.supported()) {
        locker.driver('session').put(cachePrefix, vm.content);
      }
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
     * Appends returned messages to model
     */
    function addMessages(data) {

      // Loop trough received data (for loop is the fastest)
      for (var i = 0; i < data.length; i++) {

        // Check if message by this ID doesn't exist yet
        // messageIdsInView is used as a key storage for quick reference of messages already in view
        if (messageIdsInView.indexOf(data[i]._id) === -1) {
          messageIdsInView.push(data[i]._id);
          vm.messages.push(data[i]);
        }
      }

      // Finally refresh the layout
      $timeout(function () {
        $scope.$broadcast('threadRefreshLayout');
      });

    }

    /**
     * Gets next page of messages
     * Activates when the first(top most) message hits the top viewport
     */
    function moreMessages() {
      if (vm.messageHandler.nextPage && !vm.messageHandler.paginationTimeout) {

        vm.isQuickReplyPanelHidden = true;

        if (!elemThread) elemThread = angular.element('#messages-thread');

        var oldHeight = elemThread[0].scrollHeight;

        fetchMessages().$promise.then(function (data) {
          addMessages(data);
          setScrollPosition(oldHeight);
        });

        $analytics.eventTrack('thread-pagination', {
          category: 'messages.thread',
          label: 'Message thread page ' + (vm.messageHandler.nextPage ? vm.messageHandler.nextPage.page : 0)
        });
      }
    }

    /**
     * Restores scroll position after pagination
     * Timeout is in place to force function to execute after digest cycle to properly calculate scroll height.
     */
    function setScrollPosition(oldHeight) {
      $timeout(function () {
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
      if (syncReadTimer) $timeout.cancel(syncReadTimer);
      // syncRead happens with 1s delay
      // (and gets postponed by 1s if new activateSyncRead() happens)
      if (flaggedAsRead.length > 0) {
        syncReadTimer = $timeout(syncRead, 1000);
      }
    }

    /**
     * Send messages marked at read to the API and then empty buffer
     */
    function syncRead() {
      MessagesRead.query({
        messageIds: flaggedAsRead
      }, function () {
        flaggedAsRead = [];
        // Tell app controller to sync this counter
        $rootScope.$broadcast('syncUnreadMessagesCount');
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
      if (message.read === true) return true;

      // Own messages are always read
      if (message.userFrom._id === Authentication.user._id) return true;

      // It got marked read just now
      var read = (scrollingUp === true || scrollingDown === true);
      if (message.userFrom._id !== Authentication.user._id && !message.read && read) {
        message.read = true;
        flaggedAsRead.push(message._id);
        activateSyncRead();
      }

      return read;
    }

    /**
     * Send a message
     */
    function sendMessage(msg) {
      vm.isSending = true;

      // Make sure the message isn't empty.
      // Sometimes we'll have some empty blocks due wysiwyg
      if (!msg) {
        if ($filter('plainTextLength')(vm.content) === 0) {
          vm.isSending = false;
          messageCenterService.add('warning', 'Please write a message first...');
          return;
        }
      }

      // eslint-disable-next-line new-cap
      var message = new vm.messageHandler.ajaxCall({
        content: msg,
        userTo: userTo._id,
        read: false
      });

      message.$save(function (response) {

        vm.isSending = false;

        // Remove message from cache
        if (locker.supported()) {
          locker.driver('session').forget(cachePrefix);
        }

        // Remove this when socket is back!
        vm.messages.unshift(response);

        $analytics.eventTrack('message.send', {
          category: 'messages',
          label: 'Message send'
        });

        // $timeout ensures scroll happens only after DOM has finished rendering
        $timeout(function () {
          $scope.$broadcast('threadScrollToBottom');
        });

      }, function (errorResponse) {
        vm.isSending = false;
        messageCenterService.add('danger', (errorResponse.data && errorResponse.data.message) ? errorResponse.data.message : 'Could not send the message. Please try again.');
      });
    }

  }

}());
