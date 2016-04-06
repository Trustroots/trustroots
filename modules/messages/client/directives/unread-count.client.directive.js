(function() {
  'use strict';

  angular
    .module('messages')
    .directive('messagesUnreadCount', messagesUnreadCountDirective);

  /* @ngInject */
  function messagesUnreadCountDirective($interval, MessagesCount, Authentication) {

    var directive = {
      restrict: 'A',
      replace: true,
      scope: true,
      template: '<span class="notification-badge" ng-show="unread > 0" ng-bind="unread"></span>',
      link: link
    };

    return directive;

    function link(scope, elem, attr) {

      var isChecking = false;

      scope.unread = 0;

      activate();

      /**
       * Initialize checking for unread messages
       */
      function activate() {

        if(!Authentication.user || !Authentication.user.public) {
          // If user wasn't authenticated or public, set up watch
          var activationWatch = scope.$on('userUpdated', function(user) {
            // Did user become public with that update?
            if(Authentication.user.public) {
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

        // Check for unread messages on init
        check();

        // Check for unread messages once a minute
        $interval(check, 60*1000);

        // Check for unread messages on request signal
        scope.$on('syncUnreadMessagesCount', check);
      }

      /**
       * Check for unread messages
       */
      function check() {
        if(isChecking) {
          return;
        }
        isChecking = true;
        MessagesCount.get(function(data) {
          isChecking = false;
          scope.unread = (data && data.unread) ? parseInt(data.unread) : 0;
        });
      }


    }
  }

})();
