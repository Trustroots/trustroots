(function() {
  'use strict';

  angular
    .module('pages')
    .controller('HomeController', HomeController);

  /* @ngInject */
  function HomeController($window) {

    // ViewModel
    var vm = this;

    // List of background classes
    // See /modules/core/client/less/board.less for more options
    // Background needs to support container-full class.
    // First array has background(s) for small screens, the second for bigger screens (Small = @screen-xs-max - 1px)
    vm.backgrounds = ($window.innerWidth < 767) ? ['board-forestpath'] : ['board-rainbowpeople', 'board-hitchroad'];

  }
})();
