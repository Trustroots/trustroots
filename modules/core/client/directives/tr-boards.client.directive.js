(function () {
  'use strict';

  /**
   * Directive that simply picks a background image given element and emits copyright info down the scope.
   *
   * Usage:
   * <div tr-boards="imageid">
   *
   * Or from many:
   * <div tr-boards="['imageid1', 'imageid2']">
   */
  angular
    .module('core')
    .directive('trBoards', trBoardsDirective);

  /* @ngInject */
  function trBoardsDirective() {
    return {
      restrict: 'A',
      replace: false,
      scope: {
        trBoards: '='
      },
      link: function(scope, elem) {

        // If requested photo is missing or request is invalid, rely on this photo
        var defaultPhoto = 'bokeh';

        var photos = {
          'bokeh': {
            'name': 'Sandra', // "pinkorchid_too"
            'url': 'https://www.flickr.com/photos/artfullife/3589991695',
            'license': 'CC',
            'license_url': 'https://creativecommons.org/licenses/by-sa/2.0/',
            'file': 'flickr-bokeh.jpg'
          },
          'forestpath': {
            'name': 'Johnson', // Johnson Cameraface
            'url': 'https://www.flickr.com/photos/54459164@N00/15506455245',
            'license': 'CC',
            'license_url': 'https://creativecommons.org/licenses/by-nc-sa/2.0/',
            'file': 'flickr-forestpath.jpg'
          },
          'forestpath-toned': {
            'name': 'Johnson', // Johnson Cameraface
            'url': 'https://www.flickr.com/photos/54459164@N00/15506455245',
            'license': 'CC',
            'license_url': 'https://creativecommons.org/licenses/by-nc-sa/2.0/',
            'file': 'flickr-forestpath-toned.jpg'
          },
          'sierranevada': {
            'name': 'Simona',
            'url': 'http://www.wanderlust.lt',
            'license': 'CC',
            'license_url': 'https://creativecommons.org/licenses/by-nc-nd/4.0/',
            'file': 'ss-sierranevada.jpg'
          },
          'hitchroad': {
            // https://www.facebook.com/photo.php?fbid=10152802854942931&set=pcb.10152802854987931&type=1&theater
            // Permission asked for Trustroots & Hitchwiki by Mikael Korpela
            'name': 'Andrew W Bugelli',
            'url': 'http://www.containstraces.blogspot.com/',
            'file': 'ab-hitchroad-toned.jpg' // ab-hitchroad.jpg
          },
          'guitarcamper': {
            // Permission granted for Trustroots (asked by Mikael Korpela)
            'name': 'Guillaume Ohz',
            'file': 'go-camper.jpg',
            'url': 'https://soundcloud.com/feather-drug'
          },
          'maroccomap': {
            // Permission granted for Trustroots (asked by Mikael Korpela)
            'name': 'Guillaume Ohz',
            'file': 'go-maroccomap.jpg',
            'url': 'https://soundcloud.com/feather-drug'
          },
          'rainbowpeople': {
            // Permission granted for Trustroots (asked by Mikael Korpela)
            'name': 'Antonio Fulghieri',
            'url': 'https://aaoutthere.wordpress.com/',
            'license': 'CC',
            'license_url': 'https://creativecommons.org/licenses/by-nc-nd/4.0/',
            'file': 'af-rainbow-people.jpg'
          },
          'happyhippies': {
            // Permission granted for Trustroots (asked by Mikael Korpela)
            'name': 'Antonio Fulghieri',
            'url': 'https://aaoutthere.wordpress.com/',
            'license': 'CC',
            'license_url': 'https://creativecommons.org/licenses/by-nc-nd/4.0/',
            'file': 'af-happyhippies.jpg'
          },
          'desertgirl': {
            // https://www.facebook.com/agniete.melisa
            // Permission granted for Trustroots (asked by Mikael Korpela)
            'name': 'Agnietė Melisa',
            'url': 'https://www.facebook.com/pages/My-Road-Tales/844001355694245',
            'file': 'am-desertgirl.jpg'
          },
          'wavewatching': {
            // https://www.facebook.com/gala.hyde
            // Permission granted for Trustroots (asked by Mikael Korpela)
            'name': 'Andrea Nieblas',
            'url': 'https://www.flickr.com/photos/andreanieblas/',
            'file': 'an-wavewatching.jpg'
          },
          'hitchgirl1': {
            // https://www.facebook.com/just.kozmic.blues
            // Permission granted for Trustroots (asked by Mikael Korpela)
            'name': 'Gytė',
            'url': 'https://www.facebook.com/upe.pati.teka',
            'file': 'gh-hitchgirl1.jpg'
          },
          'hitchgirl2': {
            // https://www.facebook.com/matasirastrauskas
            // Permission granted for Trustroots (asked by Mikael Korpela)
            'name': 'Matas Astrauskas',
            'url': 'http://www.matasphoto.com/',
            'file': 'mr-hitchgirl2.jpg'
          },
          'mountainforest': {
            // https://unsplash.com/photos/VNseEaTt9w4
            'name': 'Sven Scheuermeier',
            'url': 'https://unsplash.com/sveninho',
            'file': 'ss-mountainforest.jpg',
            'license': 'CC',
            'license_url': 'https://creativecommons.org/publicdomain/zero/1.0/' // https://unsplash.com/license
          },
          'tribes-1': {
            // Permission granted for Trustroots (asked by Mikael Korpela)
            'name': 'Antonio Fulghieri',
            'url': 'https://aaoutthere.wordpress.com/',
            'license': 'CC',
            'license_url': 'https://creativecommons.org/licenses/by-nc-nd/4.0/',
            'file': 'tribes-1.jpg'
          },
          'woman-bridge': {
            'name': 'Michael Hull',
            'url': 'https://unsplash.com/photos/JibIPPrvITE',
            'license': 'CC',
            'license_url': 'https://unsplash.com/license',
            'file': 'mh-woman-bridge.jpg'
          },
          'sahara-backpacker': {
            'name': 'Nova Togatorop',
            'url': 'http://novatogatorop.com/',
            'license': 'CC',
            'license_url': 'https://unsplash.com/license',
            'file': 'ak-sahara.jpg'
          },
          'hitchtruck': {
            'name': 'Nova Togatorop',
            'url': 'http://novatogatorop.com/',
            'license': 'CC',
            'license_url': 'https://unsplash.com/license',
            'file': 'nt-hitchtruck.jpg'
          }
        };

        // scope.trBoards might be an array (therefore just pick one key from it) or a string (thus just use it as is)
        var key = angular.isArray(scope.trBoards) ? scope.trBoards[Math.floor(Math.random() * (scope.trBoards.length))] : scope.trBoards;

        // Pick the photo
        var photo = photos[key] || photos[defaultPhoto];

        // Add photo as a background to the element
        elem.addClass('board-' + key);
        elem.css({
          'background-image': 'url(/modules/core/img/board/' + photo.file + ')'
        });

        // To prevent key being literally `key`: `{key: ...}`, we want it to be actual keyname such as `hitchroad`.
        var photoObject = {};
        photoObject[key] = photo;

        // Send copyright info down the scope... something will pick it up! (pst, core/app-controller)
        scope.$emit('photoCreditsUpdated', photoObject);

      }
    };
  }

}());
