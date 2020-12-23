/**
 * @ngdoc directive
 *
 * @name trustroots:trAvatar
 *
 * @param {object} user User object
 * @param {int} size Size of the image <img>. Supported values are 2048, 1024, 512, 256, 128, 64, 36, 32, 24 and 16. See avatar.less for details. Defaults to 256.
 * @param {string} source Leave empty to use user's selected source. Values "none", "facebook", "local", "gravatar".
 * @param {boolean} link Link to user's profile. Defaults to true.
 *
 * @description
 *
 * Use this directive to produce user's avatar
 *
 * @example
 *
 * <pre>
 * Basic:
 * <div tr-avatar data-user="user" size="36"></div>
 *
 * Advanced:
 * <div tr-avatar data-user="user" link="false" source="local" size="36"></div>
 * </pre>
 */
angular.module('users').directive('trAvatar', [
  '$location',
  function ($location) {
    // Options
    const defaultSize = 256;
    const defaultAvatar = '/img/avatar.png';

    return {
      template:
        '<div ng-switch="link" ng-cloak>' +
        '  <img class="avatar avatar-{{ size }} avatar-{{ source }}" ' +
        '       alt=""' +
        '       aria-hidden="true"' +
        '       ng-switch-when="false"' +
        '       ng-src="{{ avatar }}"' +
        '       draggable="false">' +
        '  <a ng-switch-when="true"' +
        '     ui-sref="profile.about({username: user.username})"' +
        '     aria-label="Open user profile for {{ ::user.displayName }}">' +
        '    <img class="avatar avatar-{{ size }} avatar-{{ source }}"' +
        '         alt=""' +
        '         aria-hidden="true"' +
        '         ng-class="avatar-{{ size }}"' +
        '         ng-src="{{ avatar }}"' +
        '         draggable="false"></a>' +
        '</div>',
      restrict: 'A',
      scope: {
        user: '=user',
      },
      controller: [
        '$scope',
        function ($scope) {
          $scope.avatar = defaultAvatar;
          $scope.size = defaultSize;

          function determineSource() {
            // Determine source for avatar
            if ($scope.fixedSource) {
              $scope.source = $scope.fixedSource;
            } else if ($scope.user && $scope.user.avatarSource) {
              $scope.source = $scope.user.avatarSource;
            } else {
              $scope.source = 'none';
            }

            // Avatar via FB
            // @link https://developers.facebook.com/docs/graph-api/reference/user/picture/
            if ($scope.source === 'facebook') {
              if (
                $scope.user &&
                $scope.user.additionalProvidersData &&
                $scope.user.additionalProvidersData.facebook &&
                $scope.user.additionalProvidersData.facebook.id
              ) {
                $scope.avatar =
                  $location.protocol() +
                  '://graph.facebook.com/' +
                  $scope.user.additionalProvidersData.facebook.id +
                  '/picture/?width=' +
                  ($scope.size || defaultSize) +
                  '&height=' +
                  ($scope.size || defaultSize);
              } else {
                $scope.avatar = defaultAvatar;
              }
              // Avatar via Gravatar
              // @link https://en.gravatar.com/site/implement/images/
            } else if ($scope.source === 'gravatar') {
              if ($scope.user.emailHash) {
                $scope.avatar =
                  $location.protocol() +
                  '://gravatar.com/avatar/' +
                  $scope.user.emailHash +
                  '?s=' +
                  ($scope.size || defaultSize);

                // This fallback image won't work via localhost since Gravatar fallback is required to be online.
                $scope.avatar +=
                  '&d=' +
                  encodeURIComponent(
                    $location.protocol() +
                      '://' +
                      $location.host() +
                      ':' +
                      $location.port() +
                      defaultAvatar,
                  );
              } else {
                $scope.avatar = defaultAvatar;
              }
              // Locally uploaded avatar
            } else if ($scope.source === 'local') {
              if (
                $scope.user.avatarUploaded &&
                $scope.user &&
                $scope.user._id
              ) {
                // Cache buster
                const timestamp = $scope.user.updated
                  ? new Date($scope.user.updated).getTime()
                  : '';

                // 32 is the smallest and 2048 biggest file size we're generating.
                const fileSize = $scope.size < 32 ? 32 : $scope.size;

                $scope.avatar =
                  '/uploads-profile/' +
                  $scope.user._id +
                  '/avatar/' +
                  fileSize +
                  '.jpg?' +
                  timestamp;
              } else {
                $scope.avatar = defaultAvatar;
              }
              // Dummy avatar
            } else {
              $scope.avatar = defaultAvatar + '?none';
            }
          } // determineSource()

          $scope.$watch('user.avatarSource', function () {
            determineSource();
          });

          $scope.$watch('user.updated', function () {
            determineSource();
          });
        },
      ],
      link(scope, element, attr) {
        // Make sure source won't change dynamicly when user changes
        if (attr.source) {
          scope.source = attr.source;
          scope.fixedSource = attr.source;
        }

        // Options
        scope.size = attr.size || defaultSize;

        // By default show the link
        scope.link = attr.link !== 'false';
      },
    };
  },
]);
