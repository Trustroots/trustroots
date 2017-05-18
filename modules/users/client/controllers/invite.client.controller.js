(function () {
  'use strict';

  angular
    .module('users')
    .controller('InviteController', InviteController);

  /* @ngInject */
  function InviteController(InvitationService) {

    // ViewModel
    var vm = this;

    // Exposed to the view
    vm.invitation = InvitationService.get();

  }

}());
