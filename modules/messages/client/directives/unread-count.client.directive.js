/**
 * Directive show unread messages counter
 *
 * Usage:
 * `<div messages-unread-count></div>`
 *
 * Adding this directive one or more times will cause `PollMessagesCount`
 * service to poll for new messages.
 */
angular
  .module('messages')
  .directive('messagesUnreadCount', messagesUnreadCountDirective);

/* @ngInject */
function messagesUnreadCountDirective(PollMessagesCount, Authentication) {
  const directive = {
    restrict: 'A',
    replace: true,
    scope: true,
    template:
      '<span class="notification-badge" ng-show="unread > 0" ng-bind="unread" aria-label="{{unread}} unread messages" tabindex="0"></span>',
    link,
  };

  return directive;

  function link(scope) {
    const favicon1xElem = angular.element('#favicon');
    const favicon2xElem = angular.element('#favicon2x');
    const faviconPath = '/img/';

    scope.unread = PollMessagesCount.getUnreadCount();

    activate();

    /**
     * Initialize checking for unread messages
     */
    function activate() {
      if (!Authentication.user || !Authentication.user.public) {
        // If user wasn't authenticated or public, set up watch
        const activationWatch = scope.$on('userUpdated', function () {
          // Did user become public with that update?
          if (Authentication.user.public) {
            // Remove this watch
            activationWatch();
            // Init activation
            activate();
          }
        });

        // Check for unread messages only if user is authenticated + public
        // Otherwise, stop here.
        return;
      }

      // Initialize polling on intervals
      PollMessagesCount.initPolling();

      // Check for unread messages on init
      PollMessagesCount.poll();

      // When we have new messages, act upon them
      const clearUnreadCountUpdated = scope.$on(
        'unreadCountUpdated',
        onUnreadCountUpdated,
      );

      // Clean out `$on` watcher when directive is removed from DOM
      scope.$on('$destroy', clearUnreadCountUpdated);
    }

    function onUnreadCountUpdated($event, newUnreadCount) {
      scope.unread = newUnreadCount;

      if (newUnreadCount > 0) {
        // Change favicon to special notification icon
        favicon1xElem.prop('href', faviconPath + 'placeholder.png');
        favicon2xElem.prop('href', faviconPath + 'placeholder.png');
      } else {
        // Change favicon back to normal
        favicon1xElem.prop('href', faviconPath + 'placeholder.png');
        favicon2xElem.prop('href', faviconPath + 'placeholder.png');
      }
    }
  }
}
