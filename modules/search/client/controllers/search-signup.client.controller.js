(function () {
  angular
    .module('search')
    .controller('SearchSignupController', SearchSignupController);

  /* @ngInject */
  function SearchSignupController($stateParams, MapLayersFactory, LocationService) {

    // ViewModel
    var vm = this;

    // Variables passed to leaflet directive at init
    vm.mapCenter = LocationService.getDefaultLocation(3);
    vm.mapLayers = {
      baselayers: MapLayersFactory.getLayers({ streets: false, satellite: true, outdoors: false })
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
    if ($stateParams.location && $stateParams.location !== '') {
      vm.searchQuery = $stateParams.location.replace('_', ' ', 'g');
    }

  }
}());
