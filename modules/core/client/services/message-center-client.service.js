/**
 * Modified from
 * @link https://github.com/e0ipso/message-center
 *
 * Licensed under GNU General Public License v2.0
 * @link https://github.com/e0ipso/message-center/blob/0187464a2dacfdb74fedb265302cb71e48df7e93/LICENSE.txt
 *
 * See also modules/core/client/directives/message-center.client.directive.js
 */

(function () {
  'use strict';

  /**
   * Service for error/success/info etc notifications
   *
   * See usage instructions from https://github.com/e0ipso/message-center
   */
  angular
    .module('core')
    .provider('$messageCenterService', MessageCenterServiceProvider)
    .service('messageCenterService', MessageCenterService);

  /* @ngInject */
  function MessageCenterServiceProvider() {
    var _this = this;
    _this.options = {};
    _this.setGlobalOptions = function (options) {
      _this.options = options;
    };
    _this.getOptions = function () {
      return _this.options;
    };
    this.$get = function () {
      return {
        setGlobalOptions: _this.setGlobalOptions,
        options: _this.options,
        getOptions: _this.getOptions
      };
    };
  }

  /* @ngInject */
  function MessageCenterService($rootScope, $sce, $timeout, $messageCenterService) {
    return {
      mcMessages: this.mcMessages || [],
      offlistener: this.offlistener || undefined,
      status: {
        unseen: 'unseen',
        shown: 'shown',
        /** @var Odds are that you will show a message and right after that
         * change your route/state. If that happens your message will only be
         * seen for a fraction of a second. To avoid that use the "next"
         * status, that will make the message available to the next page */
        next: 'next',
        /** @var Do not delete this message automatically. */
        permanent: 'permanent'
      },
      add: function (type, message, options) {
        var availableTypes = ['info', 'warning', 'danger', 'success'],
            service = this;
        options = options || {};
        var options = angular.extend({}, $messageCenterService.getOptions(), options);
        if (availableTypes.indexOf(type) === -1) {
          // eslint-disable-next-line no-throw-literal
          throw 'Invalid message type';
        }
        var messageObject = {
          type: type,
          status: options.status || this.status.unseen,
          processed: false,
          close: function () {
            return service.remove(this);
          }
        };
        messageObject.message = options.html ? $sce.trustAsHtml(message) : message;
        messageObject.html = !!options.html;
        if (angular.isDefined(options.timeout)) {
          messageObject.timer = $timeout(function () {
            messageObject.close();
          }, options.timeout);
        }
        this.mcMessages.push(messageObject);
        return messageObject;
      },
      remove: function (message) {
        var index = this.mcMessages.indexOf(message);
        this.mcMessages.splice(index, 1);
      },
      reset: function () {
        this.mcMessages = [];
      },
      removeShown: function () {
        for (var index = this.mcMessages.length - 1; index >= 0; index--) {
          if (this.mcMessages[index].status === this.status.shown) {
            this.remove(this.mcMessages[index]);
          }
        }
      },
      markShown: function () {
        for (var index = this.mcMessages.length - 1; index >= 0; index--) {
          if (!this.mcMessages[index].processed) {
            if (this.mcMessages[index].status === this.status.unseen) {
              this.mcMessages[index].status = this.status.shown;
              this.mcMessages[index].processed = true;
            }
            else if (this.mcMessages[index].status === this.status.next) {
              this.mcMessages[index].status = this.status.unseen;
            }
          }
        }
      },
      flush: function () {
        $rootScope.mcMessages = this.mcMessages;
      }
    };
  }

}());
