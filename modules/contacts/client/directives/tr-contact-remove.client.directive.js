(function () {
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
        contactToRemove: '=trContactRemove'
      },
      link: function (scope, element) {

        function openModal() {
          $uibModal.open({
            templateUrl: '/modules/contacts/views/remove-contact.client.modal.html',
            controllerAs: 'removeContactModal',
            controller: 'ContactRemoveController',
            scope: scope
          });
        }

        // Bind opening modal to the click
        element.bind('click', openModal);

      }
    };
  }
}());
