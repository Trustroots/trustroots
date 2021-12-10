angular.module('users').controller('ProfileController', ProfileController);

/* @ngInject */
function ProfileController(
  $scope,
  $stateParams,
  $state,
  $filter,
  Authentication,
  $timeout,
  profile,
  contact,
  contacts,
) {
  // No user defined at URL, just redirect to user's own profile
  if (!$stateParams.username) {
    $state.go('profile.about', { username: Authentication.user.username });
  }

  // ViewModel
  const vm = this;
  vm.profile = profile;
  vm.contact = contact;
  vm.contacts = contacts;
  vm.initialPathName = $state.current.name;

  /**
   * Remove contact via React RemoveContact component
   */
  vm.removeContact = function (contact) {
    vm.contacts.splice(vm.contacts.indexOf(contact), 1);

    // @TODO a hacky solution to remove the contact from vm.contact and keep its "promise" resolved
    // if we just delete vm.contact, the angular app will be confused
    if (vm.contact && vm.contact._id === contact._id) {
      Object.keys(contact).forEach(function (key) {
        if (!(key === '$promise' || key === '$resolved')) {
          delete contact[key];
        }
      });
    }
  };

  activate();

  /**
   * Initialize controller
   */
  function activate() {
    // When on small screen...
    if (angular.element('body').width() <= 480) {
      // By default we land to `about` tab of this controller
      // If we're on small screens, direct to `overview` tab instead
      if ($state.current.name === 'profile.about') {
        // Timeout ensures `ui-sref-active=""` gets updated at the templates
        $timeout(function () {
          $state.go('profile.overview', { username: profile.username });
        }, 25);
      }
      // When on bigger screen...
      // Redirect "mobile only" tabs to about tab
    } else if (
      ['profile.overview', 'profile.accommodation'].indexOf(
        $state.current.name,
      ) > -1
    ) {
      $state.go('profile.about', { username: profile.username });
    }

    // If this is authenticated user's own profile, measure profile description length
    if (Authentication.user._id === profile._id) {
      vm.profileDescriptionLength = Authentication.user.description
        ? $filter('plainTextLength')(Authentication.user.description)
        : 0;
    }

    /**
     * When contact removal modal signals that the contact was removed, remove it from this scope as well
     * @todo: any better way to keep vm.contact $resolved but wipe out the actual content?
     */
    $scope.$on('contactRemoved', function () {
      if (vm.contact) {
        delete vm.contact._id;
      }
    });
  }
}
