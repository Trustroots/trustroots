'use strict';

/**
 * Produce badge with user's avatar and name
 */
angular.module('users').directive('trUserBadge', ['$state',
  function($state) {
    return {
        restrict: 'EA',
        compile: function(element, attrs) {

          if(attrs.user) {
            var badge = '';

            badge += (attrs.user.username) ? '<a ui-sref="' + $state.href('profile', { username: attrs.user.username }) + '" class="badge-link">' : '<span class="badge-link">';

            badge += '<img src="/modules/users/img/avatar.png" class="avatar" width="24" height="24" alt="">';

            badge += '<span class="badge-link-label">' + attrs.displayName + '</span>';

            badge += (attrs.user.username) ? '</a>' : '</span>';

            element.replaceWith(badge);
          }

        }
    };
  }
]);