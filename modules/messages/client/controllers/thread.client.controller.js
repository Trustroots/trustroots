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

    // Vars for Host Module
    // Its to be noted at this point these options don't
    // use a persistant db but eventually for the right
    // behaviour they should, but once UI is stabilized
    // we can do it as a seperate task

    var fromDateDisp,   // from date as shown on UI
        toDateDisp,     // to date as shown on UI
        reqSurfTicked,  // if host request checkbox is ticked
        showReqSurfOpt; // if the request checkbox is to be displayed

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
    vm.profileDescriptionLength = Authentication.user.description ? $filter('plainTextLength')(Authentication.user.description) : 0;
    vm.sendMessage = sendMessage;
    vm.moreMessages = moreMessages;
    vm.messageRead = messageRead;
    vm.editorContentChanged = editorContentChanged;
    vm.content = '';

    vm.req = {};
    vm.req.reqSurfTicked = reqSurfTicked;
    vm.req.showReqSurfOpt = showReqSurfOpt;
    vm.req.hideFromDate = true;
    vm.req.hideToDate = true;

    vm.req.toDate = new Date();
    vm.req.fromDateDisp = fromDateDisp;
    vm.req.clickFromDate = clickFromDate;
    vm.req.calFromDate = calFromDate;

    vm.req.fromDate = new Date();
    vm.req.toDateDisp = toDateDisp;
    vm.req.clickToDate = clickToDate;
    vm.req.calToDate = calToDate;
    vm.req.dateOptions = { 'show-button-bar': 'true',
                           'showWeeks': false,
                           'close-text': 'Close'
                         };

    vm.req.people = people;
    vm.req.peopleCount = 1;
    vm.req.reqModVisible = reqModVisible;
    vm.req.reqDispStr = reqDispStr;

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
      userTo.$promise.then(function() {
        fetchMessages().$promise.then(function(data) {

          addMessages(data);
          vm.isInitialized = true;

          // Timeout makes sure thread-dimensions-directive has finished loading
          // and there would thus be something actually listening to these broadcasts:
          $timeout(function() {
            $scope.$broadcast('threadRefreshLayout');
            if (data.length > 0) {
              $scope.$broadcast('threadScrollToBottom');
            } else if (!vm.messages.length && !vm.content.length) {
              vm.content = '<p>I’m traveling to ______ because</p>' +
                           '<p>I chose to write to you because</p>';
            }
          });

        });
      },
      // No user...
      function(error) {
        // User not found...
        if (error.status === 404) {
          vm.isInitialized = true;
        // Other Unexpected errors...
        } else {
          messageCenterService.add('warning', error.message || 'Cannot load messages. Please refresh the page and try again.', { timeout: 20000 });
        }
      });

    }

    // Request Module Functions separate out ? //

    /**
    * @fuction reqModVisible()
    * handles the hosting request module which comes up
    * visibility & module opacity are played with to
    * ensure it come up smoothly
    */
    function reqModVisible() {
      vm.req.reqSurfTicked = ! vm.req.reqSurfTicked;
      var elemMsgReq = angular.element('#message-request');
      if (! vm.req.reqSurfTicked) {
        elemMsgReq.css({ 'opacity': '0' });
      }

      vm.req.reqSurfTicked = ! vm.req.reqSurfTicked;
      $scope.$broadcast('threadRefreshLayout');

      $timeout(function() {
        elemMsgReq.css({ 'opacity': '1' });
      }, 300);
    }

    /**
    * @fuction people(count)
    * helps with number of people travelling in host req
    */
    function people(count) {
      vm.req.peopleCount += count;
      if (vm.req.peopleCount <= 0
            || vm.req.peopleCount > 100) {
        vm.req.peopleCount = 1;
      }
    }

    /**
    * @function clickFromDate()
    * gets called after calendar is selected
    */
    function clickFromDate() {
      $scope.$broadcast('threadRefreshLayout');
      vm.req.hideFromDate = false;
      vm.req.hideToDate = true;
    }

    /**
    * @function calFromDate()
    * gets called after date is selected
    */
    function calFromDate() {
      $scope.$broadcast('threadRefreshLayout');
      vm.req.hideFromDate = true;
      vm.req.fromDateDisp = $filter('date')(vm.req.fromDate, 'dd/MM/yyyy');
    }


    /**
    * @function clickToDate()
    * gets called after calendar is selected
    */
    function clickToDate() {
      $scope.$broadcast('threadRefreshLayout');
      vm.req.hideFromDate = true;
      vm.req.hideToDate = false;

    }

    /**
    * @function calToDate()
    * gets called after date is selected
    */
    function calToDate() {
      $scope.$broadcast('threadRefreshLayout');
      vm.req.hideToDate = true;
      vm.req.toDateDisp = $filter('date')(vm.req.toDate, 'dd/MM/yyyy');
    }

    /**
    * @function reqDispStr()
    * returns the hosting information string based
    * on number of travellers & dates from/to
    */
    function reqDispStr() {
      if (!vm.req.fromDateDisp ||
            vm.req.fromDateDisp.length === 0) {
        return '';
      }

      if (!vm.req.toDateDisp ||
              vm.req.toDateDisp.length === 0) {
        return '';
      }

      if (vm.req.peopleCount === 0) {
        return '';
      }

      // Check if dates are from now to future not past
      var dnow = new Date();
      var curDiff = (dnow - vm.req.fromDate) / (24 * 3600);
      if (curDiff >= 1) {
        return '';
      }

      // if from < to
      var diff = vm.req.toDate - vm.req.fromDate;
      var dayDiff = diff / (24 * 3600);
      if (diff < 0 || dayDiff < 1) {
        return '';
      }

      return 'Hosting Request, for travelers: (' + vm.req.peopleCount
              + ') from: ' + vm.req.fromDateDisp
              + '  ~ ' + vm.req.toDateDisp;
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
     * Appends returned messages to model
     */
    function addMessages(data) {

      if (data.length === 0) {
        vm.req.showReqSurfOpt = true;
      }

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
      $timeout(function() {
        $scope.$broadcast('threadRefreshLayout');
      });

    }

    /**
     * Gets next page of messages
     * Activates when the first(top most) message hits the top viewport
     */
    function moreMessages() {
      if (vm.messageHandler.nextPage && !vm.messageHandler.paginationTimeout) {

        if (!elemThread) elemThread = angular.element('#messages-thread');

        var oldHeight = elemThread[0].scrollHeight;

        fetchMessages().$promise.then(function(data) {
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
      }, function() {
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
      if (! msg) {
        if ($filter('plainTextLength')(vm.content) === 0) {
          vm.isSending = false;
          messageCenterService.add('warning', 'Please write a message first...');
          return;
        }
      } else {
        vm.content = msg;
      }

      // Add host string to message //
      if (vm.messages.length === 0 && vm.req.reqSurfTicked) {
        var reqStr = reqDispStr();
        if (reqStr.length === 0) {
          vm.isSending = false;
          messageCenterService.add('warning', 'Kindly enter Host Request information correctly...');
          return;
        }
        vm.content = '<h5>' + reqDispStr() + '</h5><p></p>' + vm.content;
        editorContentChanged();
      }

      vm.req.showReqSurfOpt = false;

      // eslint-disable-next-line new-cap
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

        $analytics.eventTrack('message.send', {
          category: 'messages',
          label: 'Message send'
        });

        // $timeout ensures scroll happens only after DOM has finished rendering
        $timeout(function() {
          $scope.$broadcast('threadScrollToBottom');
        });

      }, function(errorResponse) {
        vm.isSending = false;
        messageCenterService.add('danger', (errorResponse.data && errorResponse.data.message) ? errorResponse.data.message : 'Could not send the message. Please try again.');
      });
    }

  }

}());
