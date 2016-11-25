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
  function trContactDirective(Authentication) {
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
      vm.user = Authentication.user;

    }
  }

}());
