/**
 * TODO remove this controller
 * https://github.com/Trustroots/trustroots/pull/1145#discussion_r364183325
 */

angular
  .module('tribes')
  .controller('TribesListController', TribesListController);

/* @ngInject */
function TribesListController(Authentication, $rootScope, $scope) {
  // ViewModel
  const vm = this;

  /**
   * Update the Authentication.user with updated tribe membership
   */
  vm.broadcastUpdatedUser = function (data) {
    if (data.user) {
      Authentication.user = data.user;
      $rootScope.$broadcast('userUpdated');
    }
  };

  /**
   * Emit photo credits info
   */
  vm.addPhotoCredits = function addPhotoCredits(photo) {
    $scope.$emit('photoCreditsUpdated', photo);
  };
  vm.removePhotoCredits = function removePhotoCredits(photo) {
    $scope.$emit('photoCreditsRemoved', photo);
  };
}
