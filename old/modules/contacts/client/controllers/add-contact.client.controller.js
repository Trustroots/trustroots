angular
  .module('contacts')
  .controller('ContactAddController', ContactAddController);

/* @ngInject */
function ContactAddController(
  $state,
  $stateParams,
  Contact,
  Authentication,
  friend,
  existingContact,
) {
  // If no friend ID defined, go to elsewhere
  if (!$stateParams.userId) {
    $state.go('profile.about');
  }

  // ViewModel
  const vm = this;

  // Exposed to the view
  vm.add = add;
  vm.isConnected = false;
  vm.isLoading = false;
  vm.friend = friend;

  vm.contact = new Contact({
    friendUserId: $stateParams.userId,
    message:
      '<p>Hi!</p><p>I would like to add you as a contact.</p><p>- ' +
      Authentication.user.displayName +
      '</p>',
  });

  /**
   * Initialize controller
   */
  init();
  function init() {
    // Prevent connecting with yourself
    if ($stateParams.userId === Authentication.user._id) {
      vm.isConnected = true;
      vm.error = 'You cannot connect with yourself. That is just silly!';
      return;
    }

    // If contact doesn't exist, stop here
    friend.$promise.then(
      function () {
        // User exists
      },
      function () {
        vm.isConnected = true;
        vm.error = 'User does not exist.';
      },
    );

    // If contact already exists, stop here
    existingContact.$promise.then(
      function (response) {
        if (response) {
          vm.isConnected = true;
          vm.success = response.confirmed
            ? 'You two are already connected. Great!'
            : 'Connection already initiated; now it has to be confirmed.';
        }
      },
      function () {
        vm.isConnected = false;
      },
    );
  }

  // Add contact
  function add() {
    vm.isLoading = true;

    vm.contact.$save(
      function () {
        vm.isLoading = false;
        vm.isConnected = true;
        vm.success =
          'Done! We sent an email to your contact and he/she still needs to confirm it.';
      },
      function (error) {
        vm.isLoading = false;
        if (error.status === 409) {
          // 409 means contact already existed
          vm.success = error.data.confirmed
            ? 'You two are already connected. Great!'
            : 'Connection already initiated; now it has to be confirmed.';
        } else {
          vm.error = error.message || 'Something went wrong. Try again.';
        }
      },
    );
  }
}
