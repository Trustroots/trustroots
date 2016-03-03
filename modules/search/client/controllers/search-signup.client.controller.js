(function() {
  'use strict';

  angular
    .module('search')
    .controller('SearchSignupController', SearchSignupController);

  /* @ngInject */
  function SearchSignupController($stateParams, $timeout, MapLayersFactory) {

    // ViewModel
    var vm = this;

    // Variables passed to leaflet directive at init
    vm.mapCenter = {
      lat: 48.6908333333,
      lng: 9.14055555556,
      zoom: 3
    };
    vm.mapLayers = {
      baselayers: {
        satellite: MapLayersFactory.satellite(vm.mapCenter)
      },
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
    vm.mapDefaults = {
      attributionControl: false,
      keyboard: false,
      worldCopyJump: true,
      zoomControl: false,
      controls: {
        layers: {
          visible: false
        }
      }
    };

    /**
     * Pass search query to the view
     */
    if($stateParams.location && $stateParams.location !== '') {
      vm.searchQuery = $stateParams.location.replace('_', ' ', 'g');
    }

  }

})();
