'use strict';

/* This declares to JSHint that 'settings' is a global variable: */
/*global settings:false */


angular.module('offers').controller('ViewOffersController', ['$scope', '$state', '$location', '$timeout', 'OffersBy', 'Authentication',
  function($scope, $state, $location, $timeout, OffersBy, Authentication) {

    // If user is not signed in then redirect to sign in form
    if (!Authentication.user) $location.path('signin');

    $scope.offer = false;

    // Leaflet
    angular.extend($scope, {
      center: {
        // Default to Europe, we set center to Offer once it loads
        lat: 48.6908333333,
        lng: 9.14055555556,
        zoom: 0
      },
      layers: {
        baselayers: {
          mapbox: {
            name: 'Default',
            type: 'xyz',
            url: '//{s}.tiles.mapbox.com/v4/{user}.{map}/{z}/{x}/{y}.png?access_token=' + settings.mapbox.access_token + ( settings.https ? '&secure=1' : ''),
            layerParams: {
              user: settings.mapbox.user,
              map: settings.mapbox.map[0]
            },
            options: {
              attribution: '<a href="http://www.openstreetmap.org">OSM</a>',
              continuousWorld: true
            }
          }
        }
      },
      paths: {
        offer: {
          weight: 2,
          color: '#12b591',
          fillColor: '#12b591',
          fillOpacity: 0.5,
          latlngs: {
            // Somehow this needs to be here although we set it later again (BTW it's, Center of Europe)
            lat: 48.6908333333,
            lng: 9.14055555556
          },
          radius: 500,
          type: 'circle'
        }
      },
      defaults: {
        scrollWheelZoom: false
      }
    });

    // Fetch that offer for us...
    if(!$scope.offer) {

      // Wait for profile from parent Controller (probably ProfileController)
      $scope.$parent.profile.$promise.then(function(profile) {

        $scope.offer = OffersBy.get({
          userId: profile._id
        }, function(offer){
            // Update also the map
            if(offer.location) {
              $scope.center.lat = parseFloat(offer.location[0]);
              $scope.center.lng = parseFloat(offer.location[1]);
              $scope.center.zoom = 12;

              $scope.paths.offer.latlngs.lat = parseFloat(offer.location[0]);
              $scope.paths.offer.latlngs.lng = parseFloat(offer.location[1]);

            }

        });

      });

    }//if !offer


    $scope.hostingDropdown = false;

    $scope.hostingStatusLabel = function() {
      var status = ($scope.offer) ? $scope.offer.status : false;
        switch(status) {
          case 'yes':
            return 'I can host';
          case 'maybe':
            return 'I might be able to host';
          default:
            return 'I cannot host currently';
        }
    };

    $scope.hostingStatus = function(status) {
      $scope.offer.status = status;
      $scope.hostingDropdown = false;
      $state.go('offer-status', {'status': status});
    };

  }
]);
