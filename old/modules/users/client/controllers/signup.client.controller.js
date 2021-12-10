import rulesModalTemplateUrl from '@/modules/users/client/views/authentication/rules-modal.client.view.html';
import shuffle from 'lodash/shuffle';

angular.module('users').controller('SignupController', SignupController);

/* @ngInject */
function SignupController(
  $rootScope,
  $http,
  $state,
  $stateParams,
  $uibModal,
  $analytics,
  Authentication,
  UserMembershipsService,
  messageCenterService,
  TribeService,
  TribesService,
) {
  // If user is already signed in then redirect to search page
  if (Authentication.user) {
    $state.go('search.map');
    return;
  }

  // View Model
  const vm = this;

  // Exposed to the view
  vm.credentials = {};
  vm.step = 1;
  vm.isLoading = false;
  vm.isEmailTaken = false;
  vm.submitSignup = submitSignup;
  vm.getUsernameValidationError = getUsernameValidationError;
  vm.openRules = openRules;
  vm.tribe = null;
  vm.suggestedTribes = [];
  vm.usernameMinlength = 3;
  vm.usernameMaxlength = 34;
  vm.suggestedTribesLimit = 4;

  // Initialize controller
  activate();

  /**
   * Initalize controller
   */
  function activate() {
    // Get list of suggested tribes
    initSuggstedTribes();
  }

  /**
   * Parse $error and return a string
   * @param {Object} usernameModel - Angular model for username form input
   * @returns {String} error text
   */
  function getUsernameValidationError(usernameModel) {
    if (!usernameModel || !usernameModel.$dirty || usernameModel.$valid) {
      return '';
    }

    const err = usernameModel.$error || {};

    if (err.required || usernameModel.$usernameValue === '') {
      return 'Username is required.';
    }

    if (err.maxlength) {
      return (
        'Too long, maximum length is ' + vm.usernameMaxlength + ' characters.'
      );
    }

    if (err.minlength) {
      return (
        'Too short, minumum length is ' + vm.usernameMinlength + ' characters.'
      );
    }

    if (err.pattern) {
      return 'Invalid username.';
    }

    if (err.username) {
      return 'This username is already in use.';
    }

    return 'Invalid username.';
  }

  /**
   * Initialize list of tribes to suggest
   * Fetches information about a tribes we suggest at signup
   * Includes specific tribe if it was refered as an URL param
   */
  function initSuggstedTribes() {
    if ($stateParams.tribe) {
      // Fetch information about referred tribe
      TribeService.get({
        tribeSlug: $stateParams.tribe,
      }).then(function (tribe) {
        // Got it
        if (tribe._id) {
          vm.tribe = tribe;
        }

        // Fetch suggested tribes list without this tribe
        getSuggestedTribes(tribe._id || null);
      });
    } else {
      // Fetch suggested tribes list
      getSuggestedTribes();
    }
  }

  /**
   * Get suggested tribes
   *
   * @param withoutTribeId {String} Tribe id to take away from array
   */
  function getSuggestedTribes(withoutTribeId) {
    TribesService.query(
      {
        limit: 40,
      },
      function (tribes) {
        const suggestedTribes = [];

        // Make sure to remove referred tribe from suggested tribes so that we won't have dublicates
        // We'll always show 2 or 3 of these at the frontend depending on if referred tribe is shown.
        if (withoutTribeId) {
          angular.forEach(
            shuffle(tribes),
            function (suggestedTribe) {
              if (suggestedTribe._id !== withoutTribeId) {
                // eslint-disable-next-line angular/controller-as-vm
                this.push(suggestedTribe);
              }
            },
            suggestedTribes,
          );
          vm.suggestedTribes = suggestedTribes;
        } else {
          vm.suggestedTribes = shuffle(tribes);
        }
      },
    );
  }

  /**
   * Register
   */
  function submitSignup() {
    vm.isLoading = true;
    vm.isEmailTaken = false;

    $http.post('/api/auth/signup', vm.credentials).then(
      function (newUser) {
        // On success function

        // If there is referred tribe, add user to that next up
        if (vm.tribe && vm.tribe._id) {
          UserMembershipsService.post(
            {
              tribeId: vm.tribe._id,
            },
            function (data) {
              updateUser(data.user || newUser.data);
              vm.isLoading = false;
              vm.step = 2;
            },
          );
        } else {
          // No tribe to join, just continue
          updateUser(newUser.data);
          vm.isLoading = false;
          vm.step = 2;
        }
      },
      function (error) {
        // On error function
        vm.isLoading = false;

        const message =
          error?.data?.message ??
          'Something went wrong while signing you up. Try again!';

        // Handle emaail errors
        if (message === 'Account with this email exists already.') {
          vm.isEmailTaken = true;
          return;
        }

        messageCenterService.add('danger', message);
      },
    );
  }

  /**
   * Assign the response to the global user model
   *
   * @param user {object} User object to be put to Authentication
   * @todo move this to Authentication service
   */
  function updateUser(user) {
    Authentication.user = user;
    $rootScope.$broadcast('userUpdated');
  }

  /**
   * Open rules modal
   */
  function openRules($event) {
    if ($event) {
      $event.preventDefault();
    }

    // Open modal
    $uibModal.open({
      templateUrl: rulesModalTemplateUrl,
    });

    // Record event to analytics
    $analytics.eventTrack('signup.rules.open', {
      category: 'signup',
      label: 'Open rules from signup form',
    });
  }
}
