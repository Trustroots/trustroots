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
 * watch (will start watching user.avatarSource and refresh each time that changes)
 */
angular.module('users').directive('trAvatar', [
  function() {

    // Options
    var defaultSize = 256,
        defaultAvatar = '/modules/users/img/avatar.png';
    return {
        //templateUrl: '/modules/users/views/directives/tr-avatar.client.view.html',
        template: '<img ng-show="user && user.$resolved" ng-src="{{avatar}}" class="avatar" width="{{size}}" height="{{size}}" alt="">',
        restrict: 'EA',
        replace: true,
        scope: {
          user: '=user'
        },
        controller: ['$scope', function($scope) {

          function determineSource() {
            console.log('->determineSource');
            // Wait for $promise first
            //$scope.user.then(function(user){
              //console.log('->determineSource ->scope.user.then');
              console.log($scope.user);


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
                if($scope.user && $scope.user.email) {
                  var fb_id = '#';
                  $scope.avatar = 'http://graph.facebook.com/' + fb_id + '/picture/?width=' +($scope.size || defaultSize) + '&height=' + ($scope.size || defaultSize);
                }
                else {
                  $scope.avatar = defaultAvatar;
                }
              }

              /**
               * Avatar via Gravatar
               * @link https://en.gravatar.com/site/implement/images/
               * @todo: pre-save email md5 hash to the db
               */
              else if($scope.source === 'gravatar') {
                if($scope.user.emailHash) {
                  $scope.avatar = 'http://gravatar.com/avatar/' + $scope.user.emailHash + '?s=' + ($scope.size || defaultSize);

                  // Gravatar fallback is required to be online. It's defined at settings.json
                  // If public default avatar is set, send it to Gravatar as failback
                  // @todo: pass defaultAvatar with public domain here
                  $scope.avatar += '&d=' + encodeURIComponent('http://ideas.trustroots.org/wordpress/wp-content/uploads/2014/10/avatar.png');
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
                $scope.avatar = defaultAvatar + '?locale';
              }

              // Dummy
              else {
                $scope.avatar = defaultAvatar + '?none';
              }
            //});// $promise
          }// determineSource()

          // Sets $scope.avatar
          //$scope.determineSource();

          // If asked to, start watching user.avatarSource and refresh directive each time that changes
          //$scope.startWatching = function() {
          //  $scope.$watch('user.avatarSource',function(newSource, oldSource) {
          //    $scope.source = newSource;
          //    determineSource();
          //  });
          //};

          $scope.$watch('user.avatarSource',function() {
            determineSource();
          });

        }],
        link: function (scope, element, attr, ctrl) {

          // Options
          scope.size = attr.size || defaultSize;

          // Wrap it to link by default
          if(!attr.link && attr.user) {
            angular.element(element).wrap('<a ng-href="#!/profile/{{user.username}}"></a>');
          }

          //if(attr.watch) scope.startWatching();

          // Make sure source won't change dynamicly when user changes
          if(attr.source) {
            scope.source = attr.source;
            scope.fixedSource = attr.source;
          }

        }
    };
  }
]);
