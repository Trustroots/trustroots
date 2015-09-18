(function() {
  'use strict';

  angular
    .module('users')
    .controller('SignupController', SignupController);

  /* @ngInject */
  function SignupController($scope, $http, $state, $stateParams, $modal, Authentication, messageCenterService) {

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
        vm.success = 'We sent you an email to ' + newUser.email + ' with further instructions. ' +
                     'If you don\'t see this email in your inbox within 15 minutes, look for it in your junk mail folder. If you find it there, please mark it as "Not Junk".';
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

      $modal.open({
        templateUrl: 'rules.client.modal.html', //inline at signup template
        controller: function ($scope, $modalInstance) {
          $scope.closeRules = function () {
            $modalInstance.dismiss('cancel');
          };
        }
      });
    }

  }

})();
