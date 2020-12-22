import templateUrl from '@/modules/contacts/client/views/remove-contact.client.modal.html';

/**
 * Remove contact directive to open up a modal to disconnect contacts
 */
angular
  .module('contacts')
  .directive('trContactRemove', trContactRemoveDirective);

/* @ngInject */
function trContactRemoveDirective($uibModal) {
  return {
    restrict: 'A',
    scope: {
      contactToRemove: '=trContactRemove',
    },
    link(scope, element) {
      function openModal() {
        $uibModal.open({
          templateUrl,
          controllerAs: 'removeContactModal',
          controller: 'ContactRemoveController',
          scope,
        });
      }

      // Bind opening modal to the click
      element.bind('click', openModal);
    },
  };
}
