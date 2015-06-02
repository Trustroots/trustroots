'use strict';

angular.module('offers').controller('AddOfferController', ['$scope', '$rootScope', '$http', '$timeout', '$state', '$stateParams', '$location', 'leafletBoundsHelpers', 'OffersBy', 'Offers', 'Authentication', 'messageCenterService', 'SettingsFactory', 'MapLayersFactory',
  function($scope, $rootScope, $http, $timeout, $state, $stateParams, $location, leafletBoundsHelpers, OffersBy, Offers, Authentication, messageCenterService, SettingsFactory, MapLayersFactory) {

    var settings = SettingsFactory.get();

    $scope.user = Authentication.user;

    $scope.isLoading = false;

    $scope.offer = false;

    var defaultLocation = {
      // Default to Europe
      lat: 48.6908333333,
      lng: 9.14055555556,
      zoom: 4
    };

    // Leaflet
    angular.extend($scope, {
      mapCenter: defaultLocation,
      mapLayers: {
        baselayers: {}
      },
      // Variables passed to leaflet directive at init
      mapDefaults: {
        scrollWheelZoom: false,
        attributionControl: true,
        keyboard: true,
        worldCopyJump: true,
        controls: {
          layers: {
            visible: true,
            position: 'bottomleft',
            collapsed: true
          }
        }
      }
    });

    $timeout(function(){
      $scope.mapLayers.baselayers.streets = MapLayersFactory.streets(defaultLocation);
      $scope.mapLayers.baselayers.satellite = MapLayersFactory.satellite(defaultLocation);
    });

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
            $scope.mapCenter.lat = parseFloat(offer.location[0]);
            $scope.mapCenter.lng = parseFloat(offer.location[1]);
            $scope.mapCenter.zoom = 16;
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
        location: [ parseFloat($scope.mapCenter.lat), parseFloat($scope.mapCenter.lng) ],
        maxGuests: parseInt(this.offer.maxGuests),
      });

      offer.$save(function(response) {
        // Done!
        $scope.isLoading = false;
        $state.go('profile', {username: $scope.user.username});
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
              messageCenterService.add('danger', 'Cannot find that place.', { timeout: settings.flashTimeout });
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
        $scope.mapCenter = {
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
