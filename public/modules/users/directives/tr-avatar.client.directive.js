'use strict';

/**
 * Produce user's avatar
 */
angular.module('users').directive('trAvatar', [
  function() {
    return {
        templateUrl: '/modules/users/views/directives/tr-avatar.client.view.html',
        restrict: 'EA',
        scope: {
          user: '=user'
        },
        link: function (scope, element, attr) {
          scope.size = attr.size;
        }
    };
  }
]);