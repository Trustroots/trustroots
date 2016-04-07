(function() {
  'use strict';

  angular
    .module('pages')
    .controller('HomeController', HomeController);

  /* @ngInject */
  function HomeController(Authentication, TribesService) {

    var headerHeight = angular.element('#tr-header').height() || 0;

    // View model
    var vm = this;

    // Exposed to the view
    vm.windowHeight = angular.element('html').height() - headerHeight;

    vm.boards = Authentication.user ? 'wavewatching' : ['rainbowpeople', 'hitchroad', 'desertgirl', 'sierranevada', 'wavewatching', 'hitchgirl1', 'hitchgirl2'];

    vm.tribes = TribesService.query({
      limit: 3
    });

  }
})();
