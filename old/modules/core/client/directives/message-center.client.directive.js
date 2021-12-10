/**
 * Modified from
 * @link https://github.com/e0ipso/message-center
 *
 * Licensed under GNU General Public License v2.0
 * @link https://github.com/e0ipso/message-center/blob/0187464a2dacfdb74fedb265302cb71e48df7e93/LICENSE.txt
 *
 * See also modules/core/client/services/message-center-client.service.js
 *
 * See usage instructions from https://github.com/e0ipso/message-center
 */

/**
 * Directive for error/success/info etc notifications
 */
angular.module('core').directive('mcMessages', mcMessages);

/* @ngInject */
function mcMessages($rootScope, messageCenterService) {
  const templateString =
    '\
  <div id="mc-messages-wrapper">\
    <div class="alert alert-{{ message.type }} {{ animation }}" ng-repeat="message in mcMessages">\
      <a class="close" ng-click="message.close();" data-dismiss="alert" aria-hidden="true">&times;</a>\
      <span ng-switch on="message.html">\
        <span ng-switch-when="true">\
          <span ng-bind-html="message.message"></span>\
        </span>\
        <span ng-switch-default>\
          {{ message.message }}\
        </span>\
      </span>\
    </div>\
  </div>\
  ';
  return {
    restrict: 'EA',
    template: templateString,
    link(scope, element, attrs) {
      // Bind the messages from the service to the root scope.
      messageCenterService.flush();
      const changeReaction = function () {
        // event, to, from
        // Update 'unseen' messages to be marked as 'shown'.
        messageCenterService.markShown();
        // Remove the messages that have been shown.
        messageCenterService.removeShown();
        $rootScope.mcMessages = messageCenterService.mcMessages;
        messageCenterService.flush();
      };
      if (angular.isUndefined(messageCenterService.offlistener)) {
        messageCenterService.offlistener = $rootScope.$on(
          '$locationChangeSuccess',
          changeReaction,
        );
      }
      scope.animation = attrs.animation || 'fade in';
    },
  };
}
