(function(){
  'use strict';

  angular.module('core').controller('FooterController', ['$scope',
    function($scope) {

      // ViewModel
      var vm = this;

      // Exposed
      vm.isTransparent = false;
      vm.isHidden = false;
      vm.photoCredits = [];

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
        },
        'horizonballoon': {
          'name': 'Wesley Stanford',
          'url': 'http://www.dualhorizons.blogspot.co.uk/'
        },
        'rainbowpeople': {
          'name': 'Antonio Fulghieri',
          'url': 'https://aaoutthere.wordpress.com/',
          'license': 'CC',
          'license_url': 'http://creativecommons.org/licenses/by-nc-nd/4.0/'
        },

      };

      // Changing footer styles/contents after navigation
      $scope.$on('$stateChangeSuccess', function(event, toState, toParams, fromState, fromParams){

        // Footer is transparent on these pages
        vm.isTransparent = (angular.isDefined(toState.footerTransparent) && toState.footerTransparent === true) ? true : false;

        // Footer is hidden on these pages
        vm.isHidden = (angular.isDefined(toState.footerHidden) && toState.footerHidden === true) ? true : false;

        // Set photo credits for these pages
        if( ['home'].indexOf(toState.name) > -1 ) {
          vm.photoCredits = [ photos.rainbowpeople, photos.hitchroad ];
        }
        else if( ['forgot', 'signin', 'welcome', 'statistics', 'media'].indexOf(toState.name) > -1 ) {
          vm.photoCredits = [ photos.bokehblue ];
        }
        else if( ['about'].indexOf(toState.name) > -1 ) {
          vm.photoCredits = [ photos.bokehblue, photos.forestpath ];
        }
        else if( ['foundation', 'donate', 'donate-help', 'donate-policy'].indexOf(toState.name) > -1 ) {
          vm.photoCredits = [ photos.forestpath ];
        }
        else if( ['faq'].indexOf(toState.name) > -1 ) {
          vm.photoCredits = [ photos.horizonballoon ];
        }
        else {
          vm.photoCredits = [];
        }

      });

    }
  ]);

})();
