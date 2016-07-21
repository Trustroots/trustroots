(function () {
  'use strict';

  angular
    .module('contacts')
    .controller('ContactsListController', ContactsListController);

  /* @ngInject */
  function ContactsListController($scope, ContactsListService) {

    // ViewModel
    var vm = this;

    // Exposed to the view
    vm.otherContact = otherContact;

    /**
     * Fetch contact list for the profile currently open in parent view
     * @todo: move to route resolver
     * @note: profileCtrl is a reference to parent "ControllerAs" (see users module)
     */
    vm.contacts = ContactsListService.query({
      listUserId: $scope.profileCtrl.profile._id
    });

    /**
     * When contact removal modal signals that the contact was removed, remove it from this list as well
     */
    $scope.$on('contactRemoved', function(event, removedContact) {
      vm.contacts.splice(vm.contacts.indexOf(removedContact), 1);
    });

    /**
     * Solve which of two contacts is "the other", not logged in user
     * This is needed since contact has users in one array
     *
     * @return String displayName, username or user object
     */
    function otherContact(profileId, contact, value) {
      var other = (contact.users[0]._id === profileId) ? contact.users[1] : contact.users[0];

      if (value === 'displayName') {
        return other.displayName;
      } else if (value === 'username') {
        return other.username;
      } else {
        // User object
        return other;
      }
    }

  }

}());
