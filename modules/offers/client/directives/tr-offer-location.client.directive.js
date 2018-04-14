(function (L) {
  'use strict';

  angular
    .module('offers')
    .directive('trOfferLocation', trOfferLocationDirective);

  /* @ngInject */
  function trOfferLocationDirective(MapMarkersFactory) {
    var directive = {
      restrict: 'A',
      replace: false,
      scope: {
        offer: '=trOfferLocation'
      },
      template: '<div leaflet' +
                '     class="offer-location"' +
                '     lf-center="trOfferLocation.mapCenter"' +
                '     markers="trOfferLocation.mapMarkers"' +
                '     layers="trOfferLocation.mapLayers"' +
                '     paths="trOfferLocation.mapPaths"' +
                '     defaults="trOfferLocation.mapDefaults"></div>',
      controller: trOfferLocationDirectiveController,
      controllerAs: 'trOfferLocation'
    };

    return directive;

    /* @ngInject */
    function trOfferLocationDirectiveController($log, $scope, MapLayersFactory) {

      var offer = $scope.offer;

      if (!offer || !offer.location) {
        $log.error('No offer or offer is missing `location`.');
        $log.log(offer);
        return;
      }

      var offerLocation = {
        lat: parseFloat(offer.location[0]),
        lng: parseFloat(offer.location[1])
      };

      // View Model
      var vm = this;

      vm.mapCenter = angular.extend(
        angular.copy(offerLocation),
        { zoom: 13 }
      );
      vm.mapLayers = {
        baselayers: MapLayersFactory.getLayers({
          streets: true,
          satellite: false,
          outdoors: false
        }),
        overlays: {
          locationPath: {
            name: 'locationPath',
            type: 'group',
            visible: true
          },
          locationMarker: {
            name: 'locationMarker',
            type: 'group',
            visible: true
          }
        }
      };
      vm.mapMarkers = {
        location: angular.extend(offerLocation, {
          icon: MapMarkersFactory.getIconConfig(offer),
          layer: 'locationMarker',
          clickable: false,
          focus: false
        })
      };
      vm.mapPaths = {
        location: MapMarkersFactory.getOfferCircle({
          latlngs: offerLocation,
          layer: 'locationPath'
        })
      };
      vm.mapDefaults = {
        scrollWheelZoom: false,
        // Whether the map can be zoomed by touch-dragging with two fingers.
        touchZoom: true,
        // Whether the map be draggable with mouse/touch or not.
        // Disabled only on mobile (`L` = Leaflet)
        dragging: !L.Browser.mobile,
        attributionControl: false,
        keyboard: false,
        controls: {
          layers: {
            visible: false
          }
        }
      };
      vm.mapEvents = {
        map: {
          enable: ['zoomend'],
          logic: 'emit'
        }
      };

      activate();

      /**
       * Initialize controller
       */
      function activate() {
        // Toggle marker/circle visible/hidden depending on zoom level
        $scope.$watch('trOfferLocation.mapCenter.zoom', function (newZoomValue) {
          vm.mapLayers.overlays.locationPath.visible = newZoomValue >= 12;
          vm.mapLayers.overlays.locationMarker.visible = newZoomValue < 12;
        });
      }

    }

  }

}(L));
