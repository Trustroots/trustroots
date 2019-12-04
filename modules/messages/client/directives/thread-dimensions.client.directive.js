(function () {
  angular
    .module('messages')
    .directive('threadDimensions', threadDimensionsDirective);

  /* @ngInject */
  function threadDimensionsDirective($window, $timeout) {

    return {
      link: function (scope, elemContainer) {

        // vars used with $timeout to cancel() timeouts.
        let refreshLayoutTimeout;
        let scrollToBottomTimeout;
        let onScrollTimeout;
        let isInitialized = false;

        // Directive is attached to #thread-container element (var elemContainer)
        // Rest of the elements are siblings (except <html> of course)

        const elemThread = angular.element('#messages-thread');
        const elemReply = angular.element('#message-reply');
        let elemReplyHeight = elemReply.height();
        const elemHtml = angular.element('html');
        const elemQuickReply = angular.element('#message-quick-reply');

        /**
         * Fire resize() at <html> so that jQuery-Waypoints wakes up and can thus
         * check what's visible on the screen and mark visible messages read.
         */
        elemThread.bind('scroll', function () {
          if (onScrollTimeout) $timeout.cancel(onScrollTimeout);
          onScrollTimeout = $timeout(function () {
            elemHtml.resize();
          }, 300);
        });

        /**
         * Timeout wrapper for refreshLayout() function
         */
        function activateRefreshLayout() {
          // Add (or reset) timeout to prevent calling this too often
          $timeout.cancel(refreshLayoutTimeout);
          refreshLayoutTimeout = $timeout(refreshLayout, 300);
        }

        /**
         * Scroll thread to bottom to show latest messages
         */
        const scrollToBottom = function () {
          elemThread.scrollTop(elemThread[0].scrollHeight);
        };

        /**
         * Timeout wrapper for scrollToBottom() function
         */
        function activateScrollToBottom() {
          // Add (or reset) timeout to prevent calling this too often
          $timeout.cancel(scrollToBottomTimeout);
          scrollToBottomTimeout = $timeout(scrollToBottom, 300);
        }


        /**
         * Refresh layout
         *
         * Keep thread in good condition when screen resizes/orientation changes/message textrea grows
         * This sorta should be at .less files, but the message thread is such an complicated peace of UI...
         * Mostly this is needed due growing text field
         */
        function refreshLayout() {

          if (!isInitialized) {
            isInitialized = true;
            $timeout(function () {
              elemContainer.css({ 'opacity': '1.0' });
            });
          }

          // Global for directive due it's used elsewhere as well
          elemReplyHeight = elemReply.height();

          const elemContainerWidth = elemContainer.width();

          // container has 15px padding on both sides when window is bigger than screen-sm-max (768px)
          const elemContainerPadding = ($window.innerWidth < 768) ? -15 : 30;

          const combinedHeight = elemReplyHeight + (elemReplyHeight / 3);

          elemQuickReply.css({
            bottom: combinedHeight
          });

          elemThread.css({
            // container has 15px padding on both sides when window is bigger than screen-sm-max (768px)
            width: elemContainerWidth - elemContainerPadding,
            // Bottom part of the message thread should touch top part of textarea
            bottom: combinedHeight + elemQuickReply.height()
          });

          // Reply area has always padding 30 on the right
          elemReply.width(elemContainerWidth - 30);
        }

        /**
         * Listeners & event bindings
         */
        scope.$on('threadRefreshLayout', function () {
          activateRefreshLayout();
        });

        scope.$on('threadScrollToBottom', function () {
          activateScrollToBottom();
        });

        angular.element($window)
          .on('resize', activateRefreshLayout)
          .bind('orientationchange', activateRefreshLayout);

        // At init, run these
        activateRefreshLayout();
        activateScrollToBottom();
        scope.$emit('threadDimensinsLoaded');

      } // link()
    };
  }
}());
