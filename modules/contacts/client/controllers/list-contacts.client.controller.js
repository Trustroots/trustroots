(function () {
  'use strict';

  angular
    .module('contacts')
    .controller('ContactsListController', ContactsListController);

  /* @ngInject */
  function ContactsListController($scope) {

    // ViewModel
    var vm = this;

    /**
     * Fetch contact list for the profile currently open in parent view
     * `profileCtrl` is a reference to a parent controller
     */
    vm.contacts = $scope.profileCtrl.contacts;

    /**
     * When contact removal modal signals that the contact was removed, remove it from this list as well
     */
    $scope.$on('contactRemoved', function(event, removedContact) {
      vm.contacts.splice(vm.contacts.indexOf(removedContact), 1);
    });

  }

}());
