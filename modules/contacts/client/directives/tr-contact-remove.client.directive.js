(function() {
  'use strict';

  /**
   * Remove contact directive to open up a modal to disconnect contacts
   */
  angular
    .module('contacts')
    .directive('trContactRemove', trContactRemoveDirective);

  /* @ngInject */
  function trContactRemoveDirective($modal) {
    return {
      restrict: 'A',
      scope: {
        contact: '=trContactRemove'
      },
      link: function(scope, element, attrs) {

        var contact = scope.contact;

        function openModal() {

          $modal.open({
            templateUrl: '/modules/contacts/views/remove-contact.client.modal.html',
            controllerAs: 'removeContactModal',
            /* @ngInject */
            controller: function($rootScope, $modalInstance, $timeout, messageCenterService, Contact) {

              var vm = this;
              vm.isLoading = false;
              vm.contact = contact;
              vm.removeContact = removeContact;
              vm.cancelContactRemoval = cancelContactRemoval;

              function removeContact() {
                vm.isLoading = true;

                // contact comes from the parent link()
                Contact.delete({contactId: contact._id},
                  // Success
                  function() {

                    // Let other controllers know that this was removed, so that they can react
                    $rootScope.$broadcast('contactRemoved', contact);

                    $modalInstance.dismiss('cancel');
                  },
                  // Error
                  function() {
                    vm.isLoading = false;
                    $modalInstance.dismiss('cancel');
                    messageCenterService.add('danger', 'Oops! Something went wrong. Try again later.', { timeout: 7000 });
                  }
                );
              }

              // Close modal
              function cancelContactRemoval() {
                $modalInstance.dismiss('cancel');
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
