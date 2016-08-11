(function () {
  'use strict';

  angular
    .module('offers')
    .controller('OffersViewController', OffersViewController);

  /* @ngInject */
  function OffersViewController($scope, $state, OffersByService, Authentication, leafletData, MapLayersFactory, LocationService) {

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
    var defaultLocation = LocationService.getDefaultLocation(5);

    // Exposed
    vm.offer = false;
    vm.hostLocation = defaultLocation;
    vm.hostingDropdown = false;
    vm.hostingStatusLabel = hostingStatusLabel;
    vm.currentSelection = {
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
    vm.mapCenter = defaultLocation;
    vm.mapDefaults = {
      scrollWheelZoom: false,
      attributionControl: false,
      keyboard: false,
      controls: {
        layers: {
          visible: false
        }
      }
    };
    vm.mapMarkers = [];
    vm.mapLayers = {
      baselayers: MapLayersFactory.getLayers({ streets: true, satellite: false, outdoors: false }),
      overlays: {
        selectedPath: {
          name: 'selectedPath',
          type: 'group',
          visible: false
        },
        selectedMarker: {
          name: 'selectedMarker',
          type: 'group',
          visible: false
        }
      }
    };
    vm.mapPaths = {
      selected: vm.currentSelection
    };
    vm.mapEvents = {
      map: {
        enable: ['zoomend'],
        logic: 'emit'
      }
    };

    /**
     * Initialize controller
     */
    init();
    function init() {

      /**
       * Toggle marker/circle visible/hidden depending on zoom level
       */
      $scope.$watch('offersView.mapCenter.zoom', function(newZoomValue) {
        vm.mapLayers.overlays.selectedPath.visible = newZoomValue >= 12;
        vm.mapLayers.overlays.selectedMarker.visible = newZoomValue < 12;
      });

      /**
       * Fetch offer
       * @todo: move to route resolve
       * @note: profileCtrl is a reference to parent "ControllerAs" (see users module)
       */
      if ($scope.profileCtrl.profile && $scope.profileCtrl.profile.$resolved && $scope.profileCtrl.profile._id) {
        vm.offer = OffersByService.get({
          userId: $scope.profileCtrl.profile._id
        }, function(offer) {
          if (offer && offer.location) {
            var offerLocation = {
              lat: parseFloat(offer.location[0]),
              lng: parseFloat(offer.location[1])
            };
            vm.currentSelection.latlngs = offerLocation;
            vm.mapLayers.overlays.selectedPath.visible = true;
            vm.mapCenter = angular.extend(angular.copy(offerLocation), { zoom: 13 });
            vm.mapMarkers.push(angular.extend(offerLocation, {
              icon: (offer.status === 'yes') ? icons.hostingYes : icons.hostingMaybe,
              layer: 'selectedMarker',
              clickable: false
            }));
            vm.hostLocation = offerLocation;

          }
        });
      }

    }


    /**
     * Helper for hosting label
     */
    function hostingStatusLabel(status) {
      switch (status) {
        case 'yes':
          return 'Can host';
        case 'maybe':
          return 'Might be able to host';
        default:
          return 'Cannot host currently';
      }
    }

  }

}());
