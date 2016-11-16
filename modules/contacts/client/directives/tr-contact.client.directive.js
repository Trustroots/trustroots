(function () {
  'use strict';

  /**
   * Produce a contact card
   *
   * Usage:
   * ```
   * <div tr-contact="contactObject" tr-contact-profile-id="currentProfileId"></div>
   * ```
   *
   * You can also define avatar size by passing `tr-contact-avatar-size="128"`
   */
  angular
    .module('contacts')
    .directive('trContact', trContactDirective);

  /* @ngInject */
  function trContactDirective() {
    return {
      templateUrl: '/modules/contacts/views/directives/tr-contact.client.view.html',
      restrict: 'A',
      replace: true,
      scope: {
        contact: '=trContact',
        profileId: '=trContactProfileId',
        avatarSize: '@trContactAvatarSize'
      },
      controller: trContactController,
      controllerAs: 'contactCtrl'
    };

    /* @ngInject */
    function trContactController($scope) {

      // ViewModel
      var vm = this;

      // Exposed to the view
      vm.contact = $scope.contact;
      vm.profileId = $scope.profileId;
      vm.avatarSize = $scope.avatarSize || 128;
      vm.otherContact = otherContact;

      /**
       * Solve which of two contacts is "the other", not logged in user
       * This is needed since contact has users in one array
       *
       * @return String displayName, username or user object
       */
      function otherContact(profileId, contact, value) {

        // Handle exceptions
        if (angular.isUndefined(contact.users) || contact.users.length < 2) {
          // Return string or empty object depending
          // if view was requesting for a value or object
          return value ? '' : {};
        }

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
  }

}());
