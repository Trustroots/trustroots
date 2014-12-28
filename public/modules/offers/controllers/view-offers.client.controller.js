'use strict';

/* This declares to JSHint that 'settings' is a global variable: */
/*global settings:false */


angular.module('offers').controller('ViewOffersController', ['$scope', '$state', '$location', '$timeout', 'OffersBy', 'Authentication', 'leafletData',
  function($scope, $state, $location, $timeout, OffersBy, Authentication, leafletData) {

    // If user is not signed in then redirect to sign in form
    if (!Authentication.user) $location.path('signin');

    $scope.offer = false;
    $scope.hostLocation = {};
    $scope.currentSelection = {
      weight: 2,
      color: '#989898',
      fillColor: '#b1b1b1',
      fillOpacity: 0.5,
      latlngs: $scope.hostLocation,
      radius: 500,
      type: 'circle',
      layer: 'selectedPath',
      clickable: false
    };

    // Leaflet
    angular.extend($scope, {
      center: {
        // Default to Europe, we set center to Offer once it loads
        lat: 48.6908333333,
        lng: 9.14055555556,
        zoom: 13
      },
      markers: [],
      layers: {
        baselayers: {
          default: {
            name: 'Streets',
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
        },
        overlays: {
          selectedPath: {
            name: 'Selected hosts Marker',
            type: 'group',
            visible: true
          },
          selectedMarker: {
            name: 'Selected hosts Marker',
            type: 'group',
            visible: false
          }
        }
      },
      paths: {
        selected: $scope.currentSelection
      },
      defaults: {
        scrollWheelZoom: false
      },
      events: {
        map: {
          enable: ['zoomend'],
          logic: 'emit'
        }
      }
    });

    //Check zoom when it changes and toggle marker or circle
    $scope.$on('leafletDirectiveMap.zoomend', function(event){
      leafletData.getMap().then(function(map) {
        $scope.zoom = map.getZoom();
        if($scope.zoom >= 12 && $scope.layers.overlays.selectedPath.visible === false) {
          $scope.layers.overlays.selectedPath.visible = true;
          $scope.layers.overlays.selectedMarker.visible = false;
        }
        else if($scope.zoom < 12 && $scope.layers.overlays.selectedMarker.visible === false){
          $scope.layers.overlays.selectedPath.visible = false;
          $scope.layers.overlays.selectedMarker.visible = true;
        }
      });
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

              $scope.markers.push({
                lat: $scope.center.lat,
                lng: $scope.center.lng,
                icon: (offer.status === 'yes') ? $scope.icons.hostingYes : $scope.icons.hostingMaybe,
                layer: 'selectedMarker'
              });

              $scope.hostLocation.lat = $scope.center.lat;
              $scope.hostLocation.lng = $scope.center.lng;
            }
        });

      });

    }//if !offer

    $scope.icons = {
      hostingYes: {
        iconUrl: '/modules/core/img/map/marker-icon-yes.svg',
        iconSize: [20, 20], // size of the icon
        iconAnchor: [10, 10] // point of the icon which will correspond to marker's location
      },
      hostingMaybe: {
        iconUrl: '/modules/core/img/map/marker-icon-maybe.svg',
        iconSize: [20, 20], // size of the icon
        iconAnchor: [10, 10] // point of the icon which will correspond to marker's location
      }
    };

    $scope.hostingDropdown = false;

    $scope.hostingStatusLabel = function() {
      var status = ($scope.offer) ? $scope.offer.status : false;
        switch(status) {
          case 'yes':
            return 'Can host';
          case 'maybe':
            return 'Might be able to host';
          default:
            return 'Cannot host currently';
        }
    };

    $scope.hostingStatus = function(status) {
      $scope.offer.status = status;
      $scope.hostingDropdown = false;
      $state.go('offer-status', {'status': status});
    };

  }
]);
