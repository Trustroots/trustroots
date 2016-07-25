(function () {
  'use strict';

  angular
    .module('tags')
    .controller('TribesListController', TribesListController);

  /* @ngInject */
  function TribesListController(tribes, Authentication) {

    // ViewModel
    var vm = this;

    // Exposed to the view
    vm.tribes = tribes;
    vm.user = Authentication.user;

  }

}());
