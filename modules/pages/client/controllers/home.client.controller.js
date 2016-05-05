(function() {
  'use strict';

  angular
    .module('pages')
    .controller('HomeController', HomeController);

  /* @ngInject */
  function HomeController(Authentication, TribesService, $stateParams) {

    var headerHeight = angular.element('#tr-header').height() || 0;

    // View model
    var vm = this;

    // Exposed to the view
    vm.windowHeight = angular.element('html').height() - headerHeight;

    // Load front page's landing photos
    // @todo, move part of this logic data to the DB
    if($stateParams.tribe && ['hitchhikers', 'dumpster-divers', 'punks'].indexOf($stateParams.tribe) > -1) {
      vm.boards = ['rainbowpeople', 'hitchroad', 'desertgirl', 'hitchgirl1', 'hitchgirl2'];
    }
    else {
      vm.boards = Authentication.user ? ['woman-bridge', 'wavewatching'] : ['woman-bridge', 'rainbowpeople', 'hitchroad', 'hitchgirl1', 'wavewatching'];
    }

    // Load example tribes
    vm.tribes = TribesService.query({
      limit: 3
    });

  }
})();
