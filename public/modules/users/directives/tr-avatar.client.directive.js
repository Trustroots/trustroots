'use strict';

/**
 * Produce user's avatar
 *
 * Basic usage:
 * <div tr-avatar data-user="user"></div>
 *
 * user (User model)
 *
 * Optional parameters:
 * size (default 32)
 * source (overwrite user's source selection)
 * link (will not wrap <img> into link)
 * watch (will start watching user.avatarSource and refresh each time that changes)
 */
angular.module('users').directive('trAvatar', [
  function() {
    return {
        //templateUrl: '/modules/users/views/directives/tr-avatar.client.view.html',
        template: '<img ng-src="{{avatar}}" class="avatar" width="{{size}}" height="{{size}}" alt="">',
        restrict: 'EA',
        replace: true,
        scope: {
          user: '=user'
        },
        controller: ['$scope', function($scope) {

          // Options
          $scope.defaultAvatar = '/modules/users/img/avatar.png';

          $scope.determineSource = function() {

            // Determine source for avatar
            if($scope.fixedSource) {
              $scope.source = $scope.fixedSource;
            }
            else if($scope.user && $scope.user.avatarSource) {
              $scope.source = $scope.user.avatarSource.toString();
            }
            else {
              $scope.source = 'none';
            }

            /**
             * Avatar via FB
             * @link https://developers.facebook.com/docs/graph-api/reference/user/picture/
             */
            if($scope.source === 'facebook' ) {
              if($scope.user && $scope.user.email) {
                var fb_id = '#';
                $scope.avatar = '//graph.facebook.com/' + fb_id + '/picture/?width=' + $scope.size + '&height=' + $scope.size;
              }
              else {
                $scope.avatar = $scope.defaultAvatar;
              }
            }

            /**
             * Avatar via Gravatar
             * @link https://en.gravatar.com/site/implement/images/
             * @todo: pre-save email md5 hash to the db
             */
            else if($scope.source === 'gravatar') {
              if($scope.user.emailHash) {
                $scope.avatar = '//gravatar.com/avatar/' + $scope.user.emailHash + '?s=' + $scope.size;

                // Gravatar fallback is required to be online. It's defined at settings.json
                // If public default avatar is set, send it to Gravatar as failback
                // @todo: pass $scope.defaultAvatar with public domain here
                $scope.avatar += '&d=' + encodeURIComponent('http://ideas.trustroots.org/wordpress/wp-content/uploads/2014/10/avatar.png');
              }
              else {
                $scope.avatar = $scope.defaultAvatar;
              }
            }

            /**
             * Locally uploaded image
             * @todo: implement this, duhh
             */
            else if($scope.source === 'locale') {
              $scope.avatar = $scope.defaultAvatar + '?locale';
            }

            // Dummy
            else {
              $scope.avatar = $scope.defaultAvatar + '?none';
            }

          };// determineSource()

          // Sets $scope.avatar
          $scope.determineSource();

          // If asked to, start watching user.avatarSource and refresh directive each time that changes
          $scope.startWatching = function() {
            $scope.$watch('user.avatarSource',function(newSource, oldSource) {
              $scope.source = newSource;
              $scope.determineSource();
            });
          };

        }],
        link: function (scope, element, attr, ctrl) {

          // Options
          scope.size = attr.size || 32;

          // Wrap it to link by default
          if(!attr.link && scope.user) {
            angular.element(element).wrap('<a href="#!/profile/'+scope.user.username+'"></a>');
          }

          if(attr.watch) scope.startWatching();

          // Make sure source won't change dynamicly when user changes
          if(attr.source) {
            scope.fixedSource = attr.source;
          }

        }
    };
  }
]);
