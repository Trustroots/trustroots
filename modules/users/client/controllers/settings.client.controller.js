(function() {
  'use strict';

  angular
    .module('users')
    .controller('SettingsController', SettingsController);

  /* @ngInject */
  function SettingsController($http, $state, Users, Authentication, messageCenterService, appSettings) {

    // ViewModel
    var vm = this;

    // Exposed
    vm.user = Authentication.user;
    vm.updateUserEmail = updateUserEmail;
    vm.resendUserEmailConfirm = resendUserEmailConfirm;
    vm.updateUserSubscriptions = updateUserSubscriptions;
    vm.changeUserPassword = changeUserPassword;
    vm.removeUser = removeUser;
    vm.removalConfirm = false;

    // Related to password reset
    vm.changeUserPasswordLoading = false;
    vm.currentPassword = '';
    vm.newPassword = '';
    vm.verifyPassword = '';

    /**
     * Change user email
     */
    function updateUserEmail() {
      vm.emailSuccess = vm.emailError = null;
      var user = new Users(vm.user);

      user.$update(function(response) {
        vm.emailSuccess = 'Email update. Check your inbox, you should have received an confirmation email which has a link you need to click. Email change will not be active until that.';
        vm.user = Authentication.user = response;
      }, function(response) {
        vm.emailError = response.data.message;
      });
    }

    /**
     * Resend confirmation email for already sent email
     */
    function resendUserEmailConfirm() {
      if(vm.user.emailTemporary) {
        vm.user.email = vm.user.emailTemporary;
        vm.updateUserEmail();
      }
    }

    /**
     * Change user email subscriptions
     */
    function updateUserSubscriptions() {
      var user = new Users(vm.user);
      user.$update(function(response) {
        messageCenterService.add('success', 'Subscriptions updated.', { timeout: appSettings.flashTimeout });
        vm.user = Authentication.user = response;
      }, function(response) {
        messageCenterService.add('error', 'Error: ' + response.data.message, { timeout: appSettings.flashTimeout });
      });
    }

    /**
     * Change user password
     */
    function changeUserPassword() {

      vm.changeUserPasswordLoading = true;

      $http.post('/api/users/password', {
        currentPassword: vm.currentPassword,
        newPassword: vm.newPassword,
        verifyPassword: vm.verifyPassword
      }).success(function(response) {
        vm.currentPassword = '';
        vm.newPassword = '';
        vm.verifyPassword = '';
        vm.changeUserPasswordLoading = false;
        vm.user = Authentication.user = response.user;
        messageCenterService.add('success', response.message, { timeout: appSettings.flashTimeout });
      }).error(function(response) {
        vm.changeUserPasswordLoading = false;
        messageCenterService.add('danger', ((response.message && response.message !== '') ? response.message : 'Password not changed due error, try again.'), { timeout: 10000 });
      });

    }

    /*
     * Remove user permanently
     */
    function removeUser() {

      if(vm.removalConfirm === true) {

        var duhhAreYouSureYouWantToRemoveYourself = confirm('We are sad to see you leave! Are you sure you want to remove your account? This whole thing cannot be undone.');

        if(duhhAreYouSureYouWantToRemoveYourself) {
          $http.post('/api/users/remove').success(function(response) {
            // @todo: redirect to sad-to-see-you-leave instead
            $state.go('home');
          }).error(function(response) {
            messageCenterService.add('danger', ((response.message && response.message !== '') ? response.message : 'Something went wrong. Try again.'), { timeout: 10000 });
          });
        }//yup, user is sure

      } // Require checkbox
      else {
        messageCenterService.add('warning', 'Choose "I understand this cannot be undone"', { timeout: appSettings.flashTimeout });
      }

    }

  }

})();
