'use strict';

/* This declares to JSHint that 'settings' and 'jQuery' are global variables: */
/*global settings:false */
/*global jQuery:false */


angular.module('offers').controller('AddOfferController', ['$scope', '$rootScope', '$http', '$timeout', '$state', '$stateParams', '$geolocation', 'leafletBoundsHelpers', 'OffersBy', 'Offers', 'Authentication',
  function($scope, $rootScope, $http, $timeout, $state, $stateParams, $geolocation, leafletBoundsHelpers, OffersBy, Offers, Authentication) {

    $scope.authentication = Authentication;

    $scope.isLoading = false;

    $scope.offer = false;

    $scope.position = $geolocation.getCurrentPosition({
      timeout: 60000 // 1min
    });

    // Leaflet
    angular.extend($scope, {
      center: {
        // Default to Europe
        lat: 48.6908333333,
        lng: 9.14055555556,
        zoom: 4
      },
      layers: {
        baselayers: {
          mapbox: {
            name: 'MapBox',
            type: 'xyz',
            url: 'http://{s}.tiles.mapbox.com/v3/{user}.{map}/{z}/{x}/{y}.png',
            layerParams: {
              user: settings.mapbox.user,
              map: settings.mapbox.map
            }
          }
        }
      },
      defaults: {
        scrollWheelZoom: true
      }
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
            $scope.center.lat = parseFloat(offer.location[0]);
            $scope.center.lng = parseFloat(offer.location[1]);
            $scope.center.zoom = 16;
          }
          // Push some defaults to offer if we didn't get proper answer...
          else {
            offer.maxGuests = 1;
            offer.status = 'yes';

            // Center map to user's location
            $scope.position.then(function(position){
              if(position.coords.latitude && position.coords.longitude) {
                $scope.center.lat = parseFloat(position.coords.latitude);
                $scope.center.lng = parseFloat(position.coords.longitude);
                $scope.center.zoom = 13;
              }
            });
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
        maxGuests: this.offer.maxGuests,
      });

      offer.$save(function(response) {
        // Done!
        $scope.isLoading = false;
        $state.go('profile');
      }, function(errorResponse) {
        $scope.isLoading = false;
        $scope.error = errorResponse.data.message;
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

        $http.get('http://api.geonames.org/searchJSON?featureClass=A&featureClass=P', {
          params: {
            q: $scope.searchQuery,
            maxRows: 1,
            lang: 'en',
            style: 'full', // 'full' since we need bbox
            type: 'json',
            username: settings.geonames.username
          }
        }).then(function(response){

          $scope.searchQuerySearching = false;

          if(response.status === 200 && response.data.geonames) {
            if(response.data.geonames.length > 0) {

              $scope.mapLocate(response.data.geonames[0]);

            }
            else {
              // @Todo: nicer alert https://github.com/Trustroots/trustroots/issues/24
              alert('Whoop! We could not find such a place...');
            }
          }
        });

      }
    };


    /*
    * Show geonames location at map
    * Used also when selecting search suggestions from the suggestions list
    */
    $scope.mapLocate = function(place) {

      // Show full place name at search  query
      $scope.searchQuery =  $scope.placeTitle(place);

      // Does the place have bounding box?
      if(place.bbox) {
        $scope.bounds = leafletBoundsHelpers.createBoundsFromArray([
          [ parseFloat(place.bbox.south), parseFloat(place.bbox.east) ],
          [ parseFloat(place.bbox.north), parseFloat(place.bbox.west) ]
        ]);
      }

      // Does it have lat/lng?
      else if(place.lat && place.lng) {
        $scope.center = {
          lat: parseFloat(place.lat),
          lng: parseFloat(place.lng),
          zoom: 5
        };
      }

      // @todo: then what?

    };


    /*
    * Search field's typeahead -suggestions
    *
    * featureClass is twice already at URL due limitations with $http.get()
    *
    * @link http://www.geonames.org/export/geonames-search.html
    */
    $scope.searchSuggestions = function(val) {

      return $http.get('http://api.geonames.org/searchJSON?featureClass=A&featureClass=P', {
        params: {
          q: val,
          maxRows: 5,
          lang: 'en',
          style: 'full', // 'full' since we need bbox
          type: 'json',
          username: settings.geonames.username
        }
      }).then(function(response){
        if(response.status === 200 && response.data.geonames.length > 0) {
          return response.data.geonames.map(function(place){
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

      // Prefer toponym name like 'Jyväskylä' instead of 'Jyvaskyla'
      if(place.toponymName) title += place.toponymName;
      else if(place.name) title += place.name;

      if(place.countryName) {
        if(title !== '') title += ', ';
        title += place.countryName;
      }

      return title;
    };


  }
]);
