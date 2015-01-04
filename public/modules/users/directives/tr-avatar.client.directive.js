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
 * size (default 256)
 * source (overwrite user's source selection)
 * link (will not wrap <img> into link)
 */
angular.module('users').directive('trAvatar', ['$location',
  function($location) {

    // Options
    var defaultSize = 256,
        defaultAvatar = '/modules/users/img/avatar.png';

    return {
        template:
          '<div ng-switch="link">' +
            '<img ng-switch-when="false" ng-src="{{avatar}}" class="avatar" width="{{size}}" height="{{size}}" alt="">' +
            '<a ng-switch-when="true" ui-sref="profile({username: user.username})"><img ng-src="{{avatar}}" class="avatar" width="{{size}}" height="{{size}}" alt=""></a>' +
          '</div>',
        restrict: 'A',
        //replace: true,
        scope: {
          user: '=user'
        },
        controller: ['$scope', function($scope) {

          $scope.avatar = defaultAvatar;
          $scope.size = defaultSize;

          function determineSource() {

              // Determine source for avatar
              if($scope.fixedSource) {
                $scope.source = $scope.fixedSource;
              }
              else if($scope.user && $scope.user.avatarSource) {
                $scope.source = $scope.user.avatarSource;
              }
              else {
                $scope.source = 'none';
              }

              /**
               * Avatar via FB
               * @link https://developers.facebook.com/docs/graph-api/reference/user/picture/
               */
              if($scope.source === 'facebook' ) {
                if($scope.user &&
                   $scope.user.additionalProvidersData &&
                   $scope.user.additionalProvidersData.facebook &&
                   $scope.user.additionalProvidersData.facebook.id) {
                     $scope.avatar = $location.protocol() + '://graph.facebook.com/' + $scope.user.additionalProvidersData.facebook.id + '/picture/?width=' +($scope.size || defaultSize) + '&height=' + ($scope.size || defaultSize);
                }
                else {
                  $scope.avatar = defaultAvatar;
                }
              }

              /**
               * Avatar via Gravatar
               * @link https://en.gravatar.com/site/implement/images/
               */
              else if($scope.source === 'gravatar') {
                if($scope.user.emailHash) {
                  $scope.avatar = $location.protocol() + '://gravatar.com/avatar/' + $scope.user.emailHash + '?s=' + ($scope.size || defaultSize);

                  // This fallback image won't work via localhost since Gravatar fallback is required to be online.
                  $scope.avatar += '&d=' + encodeURIComponent( $location.protocol() + '://' + $location.host() + ':' + $location.port() + defaultAvatar );
                }
                else {
                  $scope.avatar = defaultAvatar;
                }
              }

              /**
               * Locally uploaded image
               * @todo: implement this, duhh
               */
              else if($scope.source === 'locale') {
                $scope.avatar = '/modules/users/img/profile/uploads/'+$scope.user._id+'/avatar/256.jpg';
              }

              // Dummy
              else {
                $scope.avatar = defaultAvatar + '?none';
              }
          }// determineSource()

          $scope.$watch('user.avatarSource',function() {
            determineSource();
          });

        }],
        link: function (scope, element, attr, ctrl) {

          // Make sure source won't change dynamicly when user changes
          if(attr.source) {
            scope.source = attr.source;
            scope.fixedSource = attr.source;
          }

          // Options
          scope.size = attr.size || defaultSize;

          // By default show the link
          scope.link = (attr.link !== 'false') ? true : false;

        }
    };
  }
]);
