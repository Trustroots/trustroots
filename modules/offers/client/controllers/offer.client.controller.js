angular.module('offers').controller('OfferController', OfferController);

/* @ngInject */
function OfferController($timeout, MapLayersFactory) {
  // ViewModel
  const vm = this;
  vm.invalidateMapSize = invalidateMapSize;

  /**
   * Activate map on tab change
   * @param {Object} leafletData - Service for Leaflet
   */
  function invalidateMapSize(leafletData) {
    $timeout(function () {
      leafletData.getMap().then(function (map) {
        // @link http://leafletjs.com/reference-1.2.0.html#map-invalidatesize
        map.invalidateSize(false);
      });
    }, 300);
  }

  // Leaflet
  vm.mapLayers = {
    baselayers: MapLayersFactory.getLayers({
      streets: true,
      satellite: false,
      outdoors: false,
    }),
  };
  vm.mapDefaults = {
    scrollWheelZoom: false,
    attributionControl: true,
    keyboard: true,
    worldCopyJump: true,
    controls: {
      layers: {
        visible: false,
        position: 'bottomleft',
        collapsed: false,
      },
    },
  };
}
