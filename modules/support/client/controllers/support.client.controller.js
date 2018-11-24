(function () {
  'use strict';

  angular
    .module('support')
    .controller('SupportController', SupportController);

  /* @ngInject */
  function SupportController(SupportService, messageCenterService, $stateParams) {

    // ViewModel
    var vm = this;

    // Exposed to the view
    vm.sendSupportRequest = sendSupportRequest;
    vm.success = false;
    vm.isLoading = false;
    vm.request = {
      username: '',
      email: '',
      message: ''
    };

    activate();

    /**
     * Initialize controller
     */
    function activate() {
      if ($stateParams.report && $stateParams.report !== '') {
        vm.request.reportMember = $stateParams.report;
      }
    }

    /**
     * Send support request
     */
    function sendSupportRequest(isValid) {
      vm.success = false;
      vm.isLoading = true;

      if (!isValid) {
        vm.isLoading = false;
        return false;
      }

      if (vm.request.message === '') {
        messageCenterService.add('danger', 'Please write a message first.', { timeout: 20000 });
        vm.isLoading = false;
        return false;
      }

      var supportRequest = new SupportService(vm.request);

      supportRequest.$save(function () {
        vm.success = true;
        vm.isLoading = false;
      }, function (err) {
        vm.isLoading = false;
        messageCenterService.add('danger', err.message || 'Something went wrong. Please try again.', { timeout: 20000 });
      });

    }

  }

}());
