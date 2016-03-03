(function() {
  'use strict';

  angular
    .module('users')
    .controller('SignupController', SignupController);

  /* @ngInject */
  function SignupController($scope, $http, $state, $stateParams, $uibModal, Authentication, messageCenterService) {

    // View Model
    var vm = this;

    // If user is already signed in then redirect to search page
    if(Authentication.user) $state.go('search');

    vm.isLoading = false;
    vm.submitSignup = submitSignup;
    vm.openRules = openRules;

    /**
     * Register
     */
    function submitSignup() {
      vm.isLoading = true;

      $http.post('/api/auth/signup', vm.credentials).success(function(newUser) {
        vm.isLoading = false;
        // If successful we assign the response to the global user model
        Authentication.user = newUser;
        $scope.$emit('userUpdated');
      }).error(function(error) {
        vm.isLoading = false;
        messageCenterService.add('danger', error.message);
      });
    }

    /**
     * Open rules modal
     */
    function openRules($event) {

      if($event) $event.preventDefault();

      $uibModal.open({
        templateUrl: 'rules.client.modal.html', //inline at signup template
        controller: function ($scope, $uibModalInstance) {
          $scope.closeRules = function () {
            $uibModalInstance.dismiss('cancel');
          };
        }
      });
    }

  }

})();
