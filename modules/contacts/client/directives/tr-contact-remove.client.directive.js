(function() {
  'use strict';

  /**
   * Remove contact directive to open up a modal to disconnect contacts
   */
  angular
    .module('contacts')
    .directive('trContactRemove', trContactRemoveDirective);

  /* @ngInject */
  function trContactRemoveDirective($uibModal, Authentication) {
    return {
      restrict: 'A',
      scope: {
        contactToRemove: '=trContactRemove'
      },
      link: function(scope, element, attrs) {

        var contactToRemove = scope.contactToRemove;

        function openModal() {

          $uibModal.open({
            templateUrl: '/modules/contacts/views/remove-contact.client.modal.html',
            controllerAs: 'removeContactModal',
            /* @ngInject */
            controller: function($rootScope, $uibModalInstance, $timeout, messageCenterService, Contact) {

              var vm = this;
              vm.isLoading = false;
              vm.contact = contactToRemove;
              vm.removeContact = removeContact;
              vm.cancelContactRemoval = cancelContactRemoval;

              // Different confirm button label and modal title depending on situation

              // User is cancelling a request
              if(angular.isDefined(contactToRemove.confirmed) && contactToRemove.confirmed === false && Authentication.user._id === contactToRemove.users[1]._id) {
                vm.labelConfirm = 'Yes, revoke request';
                vm.labelTitle = 'Revoke contact request?';
                vm.labelTime = 'Requested';
              }
              // Decline received request
              else if(angular.isDefined(contactToRemove.confirmed) && contactToRemove.confirmed === false) {
                vm.labelConfirm = 'Yes, decline request';
                vm.labelTitle = 'Decline contact request?';
                vm.labelTime = 'Requested';
              }
              // Removing confirmed contact
              else {
                vm.labelConfirm = 'Yes, remove contact';
                vm.labelTitle = 'Remove contact?';
                vm.labelTime = 'Connected since';
              }

              function removeContact() {
                vm.isLoading = true;

                // contact comes from the parent link()
                Contact.delete({contactId: contactToRemove._id},
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
          });
        }

        // Bind opening modal to the click
        element.bind('click', openModal);

      }
    };
  }
})();
