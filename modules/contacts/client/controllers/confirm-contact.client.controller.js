angular
  .module('contacts')
  .controller('ContactConfirmController', ContactConfirmController);

/* @ngInject */
function ContactConfirmController($stateParams, Authentication, contact) {
  // ViewModel
  const vm = this;

  // If no friend ID defined, go to elsewhere
  if (!$stateParams.contactId) {
    vm.error = 'Something went wrong. Try again.';
  }

  vm.isConnected = false;
  vm.isLoading = true;
  vm.contact = contact;
  vm.confirmContact = confirmContact;

  // First fetch contact object, just to make it sure it exists
  vm.contact.$promise.then(
    // Got contact
    function () {
      vm.isLoading = false;
      if (vm.contact.confirmed === true) {
        vm.isConnected = true;
        vm.success = 'You two are already connected. Great!';
      } else if (vm.contact.userTo._id !== Authentication.user._id) {
        vm.error = 'You must wait until they confirm your connection.';
      }
    },
    // Error getting contact
    function (errorResponse) {
      vm.isWrongCode = true;
      vm.error =
        errorResponse.status === 404
          ? 'Could not find contact request. Check the confirmation link from email or you might be logged in with wrong user?'
          : 'Something went wrong. Try again.';
    },
  );

  function confirmContact() {
    vm.isLoading = true;
    vm.contact.confirm = true;
    vm.contact.$update(
      function () {
        vm.isLoading = false;
        vm.isConnected = true;
        vm.success = 'You two are now connected!';
      },
      function (errorResponse) {
        vm.isLoading = false;
        vm.error =
          errorResponse.data.message || 'Something went wrong. Try again.';
      },
    );
  }
}
