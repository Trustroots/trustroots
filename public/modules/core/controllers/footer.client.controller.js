'use strict';

angular.module('core').controller('FooterController', ['$scope', 'Authentication', 'Menus',
  function($scope, Authentication, Menus) {

    $scope.isTransparent = false;
    $scope.isHidden = false;
    $scope.photo_credits = [];

    /*
     * Please try to keep this updated while you add/change/remove images from different pages
     */
    var photos = {

      'bokehblue': {
        'name': 'Sandra',
        'url': 'https://www.flickr.com/photos/artfullife/3589991695',
        'license': 'CC',
        'license_url': 'https://creativecommons.org/licenses/by-sa/2.0/'
      },
      'sierranevada': {
        'name': 'Simona',
        'url': 'http://www.wanderlust.lt',
        'license': 'CC',
        'license_url': 'http://creativecommons.org/licenses/by-nc-nd/4.0/'
      },
      'hitchroad': {
        'name': 'Andrew W Bugelli',
        'url': 'http://www.containstraces.blogspot.com/'
      },
      'forestpath': {
        'name': 'Johnson',
        'url': 'https://www.flickr.com/photos/54459164@N00/15506455245',
        'license': 'CC',
        'license_url': 'https://creativecommons.org/licenses/by-nc-sa/2.0/'
      }

    };



    // Changing footer styles/contents after navigation
    $scope.$on('$stateChangeSuccess', function(event, toState, toParams, fromState, fromParams){
      $scope.isTransparent = (['home', 'forgot', 'signin', 'welcome'].indexOf(toState.name) > -1) ? true : false;
      $scope.isHidden = (['listMessages'].indexOf(toState.name) > -1) ? true : false;

      // Set photo credits for this page
      if( ['home'].indexOf(toState.name) > -1 ) {
        $scope.photo_credits = [ photos.sierranevada, photos.hitchroad ];
      }
      else if( ['forgot', 'signin', 'welcome', 'statistics'].indexOf(toState.name) > -1 ) {
        $scope.photo_credits = [ photos.bokehblue ];
      }
      else if( ['about'].indexOf(toState.name) > -1 ) {
        $scope.photo_credits = [ photos.bokehblue, photos.forestpath ];
      }
      else {
        $scope.photo_credits = [];
      }

    });

  }
]);
