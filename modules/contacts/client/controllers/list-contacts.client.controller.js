(function() {
  'use strict';

  angular
    .module('contacts')
    .controller('ContactsListController', ContactsListController);

  /* @ngInject */
  function ContactsListController($scope, ContactsListService) {

    // ViewModel
    var vm = this;

    /**
     * Fetch contact list for the profile currently open in parent view
     * @todo: move to route resolver
     * @note: profileCtrl is a reference to parent "ControllerAs" (see users module)
     */
    vm.contacts = ContactsListService.query({
      listUserId: $scope.profileCtrl.profile._id
    });
  }

})();
