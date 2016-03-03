(function() {
  'use strict';

  angular
    .module('support')
    .controller('SupportController', SupportController);

  /* @ngInject */
  function SupportController($http, messageCenterService) {

    // ViewModel
    var vm = this;

    // Expoxed to the view
    vm.sendSupportRequest = sendSupportRequest;
    vm.success = false;
    vm.isLoading = false;
    vm.request = {
      username: '',
      email: '',
      message: ''
    };

    function sendSupportRequest(isValid) {
      vm.success = false;
      vm.isLoading = true;

      if(vm.request.message === '') {
        messageCenterService.add('danger', 'Please write a message.', { timeout: 20000 });
        vm.isLoading = false;
        return false;
      }

      if (!isValid) {
        vm.isLoading = false;
        return false;
      }

      $http.post('/api/support', vm.request)
        .success(function() {
          vm.success = true;
          vm.isLoading = false;
        }).error(function(response) {
          vm.isLoading = false;
          messageCenterService.add('danger', response.message || 'Something went wrong. Please try again.', { timeout: 20000 });
        });

    }

  }

})();
