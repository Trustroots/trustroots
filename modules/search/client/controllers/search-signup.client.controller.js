(function() {
  'use strict';

  angular
    .module('search')
    .controller('SearchSignupController', SearchSignupController);

  /* @ngInject */
  function SearchSignupController($stateParams, $timeout, MapLayersFactory, LocationService) {

    // ViewModel
    var vm = this;

    // Variables passed to leaflet directive at init
    vm.mapCenter = LocationService.getDefaultLocation(3);
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
