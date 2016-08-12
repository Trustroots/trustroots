(function () {
  'use strict';

  angular
    .module('contacts')
    .controller('ContactRemoveController', ContactRemoveController);

  /* @ngInject */
  function ContactRemoveController($scope, $rootScope, $uibModalInstance, messageCenterService, Contact, Authentication) {

    var contactToRemove = $scope.contactToRemove;

    // ViewModel
    var vm = this;

    // Exposed to the view
    vm.isLoading = false;
    vm.contact = contactToRemove;
    vm.removeContact = removeContact;
    vm.cancelContactRemoval = cancelContactRemoval;

    // Different confirm button label and modal title depending on situation

    if (angular.isDefined(contactToRemove.confirmed) && contactToRemove.confirmed === false && Authentication.user._id === contactToRemove.users[1]._id) {
      // User is cancelling a request
      vm.labelConfirm = 'Yes, revoke request';
      vm.labelTitle = 'Revoke contact request?';
      vm.labelTime = 'Requested';
    } else if (angular.isDefined(contactToRemove.confirmed) && contactToRemove.confirmed === false) {
      // Decline received request
      vm.labelConfirm = 'Yes, decline request';
      vm.labelTitle = 'Decline contact request?';
      vm.labelTime = 'Requested';
    } else {
      // Removing confirmed contact
      vm.labelConfirm = 'Yes, remove contact';
      vm.labelTitle = 'Remove contact?';
      vm.labelTime = 'Connected since';
    }

    function removeContact() {
      vm.isLoading = true;

      // contact comes from the parent link()
      Contact.delete({ contactId: contactToRemove._id },
        // Success
        function() {

          // Let other controllers know that this was removed, so that they can react
          $rootScope.$broadcast('contactRemoved', contactToRemove);

          $uibModalInstance.dismiss('cancel');
        },
        // Error
        function() {
          vm.isLoading = false;
          $uibModalInstance.dismiss('cancel');
          messageCenterService.add('danger', 'Oops! Something went wrong. Try again later.', { timeout: 7000 });
        }
      );
    }

    // Close modal
    function cancelContactRemoval() {
      $uibModalInstance.dismiss('cancel');
    }

  }

}());
