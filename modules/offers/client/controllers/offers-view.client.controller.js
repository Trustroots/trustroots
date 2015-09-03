(function() {
  'use strict';

  angular
    .module('offers')
    .controller('OffersViewController', OffersViewController);

  /* @ngInject */
  function OffersViewController($scope, $state, $location, OffersByService, Authentication, leafletData, MapLayersFactory) {

    // ViewModel
    var vm = this;

    // Variables
    var icons = {
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
    var defaultLocation = {
      // Default to Europe, we set center to Offer once it loads
      lat: 48.6908333333,
      lng: 9.14055555556,
      zoom: 5
    };
    var currentSelection = {
      weight: 2,
      color: '#989898',
      fillColor: '#b1b1b1',
      fillOpacity: 0.5,
      latlngs: defaultLocation,
      radius: 500, // Meters
      type: 'circle',
      layer: 'selectedPath',
      clickable: false
    };
    var mapLayers = {
      baselayers: {
        streets: MapLayersFactory.streets(defaultLocation)
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
    };
    var mapDefaults = {
      scrollWheelZoom: false,
      attributionControl: false,
      keyboard: false,
      controls: {
        layers: {
          visible: false
        }
      }
    };

    // Exposed
    vm.offer = false;
    vm.hostLocation = defaultLocation;
    vm.hostingDropdown = false;
    vm.hostingStatusLabel = hostingStatusLabel;
    vm.currentSelection = currentSelection;
    vm.mapCenter = defaultLocation;
    vm.mapDefaults = mapDefaults;
    vm.mapMarkers = [];
    vm.mapLayers = mapLayers;
    vm.mapPaths = {
      selected: vm.currentSelection
    };
    vm.mapEvents = {
      map: {
        enable: ['zoomend'],
        logic: 'emit'
      }
    };


    // Check zoom when it changes and toggle marker or circle
    $scope.$on('leafletDirectiveMap.zoomend', function(event){
      leafletData.getMap('offer-location-canvas').then(function(map) {
        vm.mapZoom = map.getZoom();
        if(vm.mapZoom >= 12 && vm.mapLayers.overlays.selectedPath.visible === false) {
          vm.mapLayers.overlays.selectedPath.visible = true;
          vm.mapLayers.overlays.selectedMarker.visible = false;
        }
        else if(vm.mapZoom < 12 && vm.mapLayers.overlays.selectedMarker.visible === false){
          vm.mapLayers.overlays.selectedPath.visible = false;
          vm.mapLayers.overlays.selectedMarker.visible = true;
        }
      });
    });

    /**
     * Fetch offer
     * @todo: move to route resolve
     * @note: profileCtrl is a reference to parent "ControllerAs" (see users module)
     */
    vm.offer = OffersByService.get({
      userId: $scope.profileCtrl.profile._id
    }, function(offer) {
      if(offer && offer.location) {
        var offerLocation = {
          lat: parseFloat(offer.location[0]),
          lng: parseFloat(offer.location[1])
        };
        vm.currentSelection.latlngs = offerLocation;
        vm.mapCenter = angular.extend(offerLocation, {zoom: 13});
        vm.mapMarkers.push(angular.extend(offerLocation, {
          icon: (offer.status === 'yes') ? icons.hostingYes : icons.hostingMaybe,
          layer: 'selectedMarker'
        }));
        vm.hostLocation = offerLocation;
      }
    });

    /**
     * Helper for hosting label
     */
    function hostingStatusLabel(status) {
      switch(status) {
        case 'yes':
          return 'Can host';
        case 'maybe':
          return 'Might be able to host';
        default:
          return 'Cannot host currently';
      }
    }

  }

})();
