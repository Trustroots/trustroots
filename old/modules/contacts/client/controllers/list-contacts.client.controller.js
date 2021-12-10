angular
  .module('contacts')
  .controller('ContactsListController', ContactsListController);

/* @ngInject */
function ContactsListController($scope, $rootScope) {
  // ViewModel
  const vm = this;

  /**
   * Fetch contact list for the profile currently open in parent view
   * `profileCtrl` is a reference to a parent controller
   */
  vm.contacts = $scope.profileCtrl.contacts;

  /**
   * provide broadcast function for react removeContact component
   */
  vm.broadcastRemoveContact = function (contact) {
    $rootScope.$broadcast('contactRemoved', contact);
  };

  /**
   * When contact removal modal signals that the contact was removed, remove it from this list as well
   */
  $scope.$on('contactRemoved', function (event, removedContact) {
    vm.contacts.splice(vm.contacts.indexOf(removedContact), 1);
  });
}
