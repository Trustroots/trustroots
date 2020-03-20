import templateUrl from '@/modules/contacts/client/views/directives/tr-contact.client.view.html';

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
angular.module('contacts').directive('trContact', trContactDirective);

/* @ngInject */
function trContactDirective(Authentication) {
  return {
    templateUrl,
    restrict: 'A',
    replace: true,
    scope: {
      contact: '=trContact',
      profileId: '=trContactProfileId',
      avatarSize: '@trContactAvatarSize',
      hideMeta: '=trContactHideMeta',
    },
    controller: trContactController,
    controllerAs: 'contactCtrl',
  };

  /* @ngInject */
  function trContactController($scope) {
    // ViewModel
    const vm = this;

    // Exposed to the view
    vm.contact = $scope.contact;
    vm.profileId = $scope.profileId;
    vm.avatarSize = $scope.avatarSize || 128;
    vm.user = Authentication.user;

    // Hides meta info such as "connected since"
    vm.hideMeta = $scope.hideMeta || false;
  }
}
