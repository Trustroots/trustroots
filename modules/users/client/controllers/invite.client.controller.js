(function () {
  'use strict';

  angular
    .module('users')
    .controller('InviteController', InviteController);

  /* @ngInject */
  function InviteController(InvitationService, appSettings) {

    // ViewModel
    var vm = this;

    // Exposed to the view
    vm.getCode = getCode;

    function getCode() {
      return InvitationService.dateToCode(
        appSettings.inviteKey,
        new Date()
      );
    }

  }

}());
