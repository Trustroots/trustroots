'use strict';

angular.module('offers').controller('AddOfferController', ['$scope', '$rootScope', '$http', '$timeout', '$state', '$stateParams', '$location', 'leafletBoundsHelpers', 'OffersBy', 'Offers', 'Authentication', 'messageCenterService', 'SettingsFactory',
  function($scope, $rootScope, $http, $timeout, $state, $stateParams, $location, leafletBoundsHelpers, OffersBy, Offers, Authentication, messageCenterService, SettingsFactory) {

    var settings = SettingsFactory.get();

    $scope.user = Authentication.user;

    $scope.isLoading = false;

    $scope.offer = false;

    // Leaflet
    angular.extend($scope, {
      center: {
        // Default to Europe
        lat: 48.6908333333,
        lng: 9.14055555556,
        zoom: 4
      },
      layers: {
        baselayers: {}
      },
      defaults: {
        scrollWheelZoom: false
      }
    });

    // Add street layer to the map
    if(settings.mapbox.map.default && settings.mapbox.user && settings.mapbox.publicKey) {
      $scope.layers.baselayers.streets = {
        name: 'Streets',
        type: 'xyz',
        url: '//{s}.tiles.mapbox.com/v4/{user}.{map}/{z}/{x}/{y}.png?access_token=' + settings.mapbox.publicKey + ( settings.https ? '&secure=1' : ''),
        layerParams: {
          user: settings.mapbox.user,
          map: settings.mapbox.map.default
        },
        layerOptions: {
          attribution: '<a href="http://www.openstreetmap.org/">OSM</a>',
          continuousWorld: true,
          TRStyle: 'street'//Not native Leaflet key, required by our layer switch
        }
      };
    }
    else {
      // If no default or satellite map by mapbox, default to OSM
      $scope.layers.baselayers.streets = {
        name: 'Streets',
        type: 'xyz',
        url: '//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        layerOptions: {
          subdomains: ['a', 'b', 'c'],
          attribution: '<a href="https://www.openstreetmap.org/">OSM</a>',
          continuousWorld: true,
          TRStyle: 'street'//Not native Leaflet key, required by our layer switch
        }
      };
    }

    // Add Satellite layer to the map
    if(settings.mapbox.map.satellite && settings.mapbox.user && settings.mapbox.publicKey) {
      $scope.layers.baselayers.satellite = {
        name: 'Satellite',
        type: 'xyz',
        url: '//{s}.tiles.mapbox.com/v4/{user}.{map}/{z}/{x}/{y}.png?access_token=' + settings.mapbox.publicKey + ( settings.https ? '&secure=1' : ''),
        layerParams: {
          user: settings.mapbox.user,
          map: settings.mapbox.map.satellite
        },
        layerOptions: {
          attribution: '<a href="http://www.openstreetmap.org/">OSM</a>',
          continuousWorld: true,
          TRStyle: 'satellite'//Not native Leaflet key, required by our layer switch
        }
      };
    }
    // MapQuest as a fallback Satellite
    else {
      $timeout(function() {
        $scope.layers.baselayers.satellite = {
          name: 'Satellite',
          type: 'xyz',
          url: '//otile{s}.mqcdn.com/tiles/1.0.0/sat/{z}/{x}/{y}.jpg',
          layerOptions: {
            subdomains: ['1', '2', '3', '4'],
            attribution: 'Tiles by <a href="http://www.mapquest.com/">MapQuest</a>',
            continuousWorld: true,
            TRStyle: 'satellite' // Not native Leaflet key, required by our layer switch
          }
        };
      });
    }


    // Check if user already has previous offer
    $scope.findOffer = function() {

      $scope.isLoading = true;

      OffersBy.get({
        userId: Authentication.user._id
      }, function(offer){

        // Make sure $scope.$apply() updates results
        // @link http://jimhoskins.com/2012/12/17/angularjs-and-apply.html
        $timeout(function() {

          $scope.isLoading = false;

          // Offer with location, must be real thing!
          if(offer.location) {
            $scope.center.lat = parseFloat(offer.location[0]);
            $scope.center.lng = parseFloat(offer.location[1]);
            $scope.center.zoom = 16;
          }
          // Push some defaults to offer if we didn't get proper answer...
          else {
            offer.maxGuests = 1;
            offer.status = 'yes';
          }

          // Determine new status from URL, overrides previous status
          if($stateParams.status && jQuery.inArray( $stateParams.status, ['yes', 'maybe', 'no'] ) ) {
            offer.status = $stateParams.status;
          }

          $scope.offer = offer;

        });
      });

    };


    $scope.addOffer = function() {
      $scope.isLoading = true;

      var offer = new Offers({
        status: this.offer.status,
        description: this.offer.description,
        noOfferDescription: this.offer.noOfferDescription,
        location: [ parseFloat($scope.center.lat), parseFloat($scope.center.lng) ],
        maxGuests: parseInt(this.offer.maxGuests),
      });

      offer.$save(function(response) {
        // Done!
        $scope.isLoading = false;
        $state.go('profile');
      }, function(err) {
        $scope.isLoading = false;
        var errorMessage = (err.data.message) ? err.data.message : 'Error occured. Please try again.';
        messageCenterService.add('danger', errorMessage, { timeout: settings.flashTimeout });
      });

    };


    /**
    * Map address search
    */
    $scope.searchQuery = '';
    $scope.searchQuerySearching = false;
    $scope.enterSearchAddress = function (event) {
      if (event.which === 13) {
        event.preventDefault();
        $scope.searchAddress();
      }
    };
    $scope.searchAddress = function () {
      if($scope.searchQuery !== '') {
        $scope.searchQuerySearching = true;

        $http
          .get('//api.tiles.mapbox.com/v4/geocode/mapbox.places-v1/' + $scope.searchQuery + '.json?access_token=' + settings.mapbox.publicKey)
          .then(function(response) {

            $scope.searchQuerySearching = false;

            if(response.status === 200 && response.data.features && response.data.features.length > 0) {
              $scope.mapLocate(response.data.features[0]);
            }
            else {
              // @Todo: nicer alert https://github.com/Trustroots/trustroots/issues/24
              alert('Whoop! We could not find such a place...');
            }
          });

      }
    };


    /*
    * Show geo location at map
    * Used also when selecting search suggestions from the suggestions list
    */
    $scope.mapLocate = function(place) {

      // Show full place name at search  query
      $scope.searchQuery =  $scope.placeTitle(place);

      // Does the place have bounding box?
      if(place.bbox) {
        $scope.bounds = leafletBoundsHelpers.createBoundsFromArray([
          [ parseFloat(place.bbox[1]), parseFloat(place.bbox[0]) ],
          [ parseFloat(place.bbox[3]), parseFloat(place.bbox[2]) ]
        ]);
      }

      // Does it have lat/lng?
      else if(place.center) {
        $scope.center = {
          lat: parseFloat(place.center[0]),
          lng: parseFloat(place.center[1]),
          zoom: 5
        };
      }

    };


    /*
    * Search field's typeahead -suggestions
    *
    * @link https://www.mapbox.com/developers/api/geocoding/
    */
    $scope.searchSuggestions = function(val) {

     return $http
       .get('//api.tiles.mapbox.com/v4/geocode/mapbox.places-v1/' + val + '.json?access_token=' + settings.mapbox.publicKey)
       .then(function(response) {

         $scope.searchQuerySearching = false;

         if(response.status === 200 && response.data.features && response.data.features.length > 0) {

             return response.data.features.map(function(place){
               place.trTitle = $scope.placeTitle(place);
               return place;
             });

         }
         else return [];
       });

    };

    /*
    * Compile a nice title for the place, eg. "Jyväskylä, Finland"
    */
    $scope.placeTitle = function(place) {
      var title = '';

      if(place.place_name) title += place.place_name;
      else if(place.text) title += place.text;

      return title;
    };


  }
]);
