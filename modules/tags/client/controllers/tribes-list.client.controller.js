(function() {
  'use strict';

  angular
    .module('tags')
    .controller('TribesListController', TribesListController);

  /* @ngInject */
  function TribesListController(tribes) {

    // ViewModel
    var vm = this;

    // Exposed to the view
    vm.tribes = tribes;

  }

})();
