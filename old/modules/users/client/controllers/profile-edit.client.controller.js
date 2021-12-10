angular
  .module('users')
  .controller('ProfileEditController', ProfileEditController);

/* @ngInject */
function ProfileEditController($scope, $confirm, $state) {
  // ViewModel
  const vm = this;

  // Exposed to the view
  vm.unsavedModifications = false;

  // Clear modifications
  $scope.$on('userUpdated', function () {
    vm.unsavedModifications = false;
  });

  // React when state changes and there are unsaved modifications
  $scope.$on('$stateChangeStart', function (event, toState, toParams) {
    if (vm.unsavedModifications) {
      // Cancel original $state transition
      // transitionTo() promise will be rejected with
      // a 'transition prevented' error
      event.preventDefault();

      // Ask for confirmation
      $confirm({
        title: 'Are you sure?',
        text: 'Your changes would be lost. Return and press "Save" to keep the changes, or press "Continue" to discard them.',
        ok: 'Continue',
        cancel: 'Cancel',
      })
        // If user pressed "continue", create another state go
        .then(function () {
          vm.unsavedModifications = false;
          $state.go(toState.name, toParams);
        });
    }
  });
}
