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
    var validSources = ['none', 'facebook' ,'gravatar', 'locale'];
    return {
        //templateUrl: '/modules/users/views/directives/tr-avatar.client.view.html',
        template: '<img ng-src="{{avatar}}" class="avatar" width="{{size}}" height="{{size}}" alt="">',
        restrict: 'EA',
        replace: true,
        scope: {
          user: '=user'
        },
        controller: ['$scope', function($scope) {

          if($scope.user) {
              console.log('->avatar: ' + $scope.user.username);
              console.log($scope.user);
          }
          else console.log('->avatar ');

          // Options
          $scope.defaultAvatar = '/modules/users/img/avatar.png';


          $scope.determineSource = function() {

            // Determine source for avatar
            if($scope.fixedSource) {// && validSources.indexOf(attr.source)==-1)
              $scope.source = $scope.fixedSource;
            }
            else if($scope.user && $scope.user.avatarSource) {
              // && validSources.indexOf($scope.user.avatarSource.toString())==-1)
              $scope.source = $scope.user.avatarSource.toString();
              console.log('users avatarSource: ' + $scope.source);
            }
            else {
              $scope.source = 'none';
            }

            /**
             * Avatar via FB
             * @link https://developers.facebook.com/docs/graph-api/reference/user/picture/
             */
            if($scope.source === 'facebook' ) {
              console.log('->determineSource: fb');

              if($scope.user && $scope.user.email) {
                var fb_id = '#';

                $scope.avatar = '//graph.facebook.com/' + fb_id + '/picture/?width=' + $scope.size + '&height=' + $scope.size;
              }
              else {
                console.log('->determineSource facebook: fall to default');
                $scope.avatar = $scope.defaultAvatar;
              }
            }

            /**
             * Avatar via Gravatar
             * @link https://en.gravatar.com/site/implement/images/
             * @todo: pre-save email md5 hash to the db
             */
            else if($scope.source === 'gravatar') {
              console.log('->determineSource gravatar: ' + $scope.user.emailHash);
              if($scope.user.emailHash) {
                $scope.avatar = '//gravatar.com/avatar/' + $scope.user.emailHash + '?s=' + $scope.size;

                // Gravatar fallback is required to be online. It's defined at settings.json
                // If public default avatar is set, send it to Gravatar as failback
                // @todo: pass $scope.defaultAvatar with public domain here
                $scope.avatar += '&d=' + encodeURIComponent('http://ideas.trustroots.org/wordpress/wp-content/uploads/2014/10/avatar.png');
              }
              else {
                console.log('->determineSource gravatar: fall to default');
                $scope.avatar = $scope.defaultAvatar;
              }
            }

            /**
             * Locally uploaded image
             */
            else if($scope.source === 'locale') {
              console.log('->determineSource: locale');
              $scope.avatar = $scope.defaultAvatar + '?locale';
            }

            // Dummy
            else {
              console.log('->determineSource: none');
              $scope.avatar = $scope.defaultAvatar + '?none';
            }
          };// determineSource()

          // Sets $scope.avatar
          $scope.determineSource();

          // If asked to, start watching user.avatarSource and refresh directive each time that changes
          //if(attr.watch) {
            $scope.$watch('user.avatarSource',function(newSource, oldSource) {
              console.log('avatarSource changed. new: ' + newSource + ', old: ' + oldSource);
              $scope.source = newSource;
              $scope.determineSource();
            });
          //}


        }],
        link: function (scope, element, attr, ctrl) {

          scope.size = attr.size || 32;

          // Wrap it to link by default
          //if(!attr.link && scope.user) {
          //  angular.element(element).wrap('<a href="#!/profile/'+scope.user.username+'"></a>');
          //}
          if(attr.source) {
            scope.fixedSource = attr.source;
          }

        }
    };
  }
]);
