(function (jQuery) {
  'use strict';

  angular
    .module('users')
    .controller('SignupController', SignupController);

  /* @ngInject */
  function SignupController($rootScope, $http, $q, $state, $stateParams, $location, $uibModal, $analytics, $window, Authentication, UserMembershipsService, messageCenterService, TribeService, TribesService, InvitationService, SettingsFactory, locker) {

    // If user is already signed in then redirect to search page
    if (Authentication.user) {
      $state.go('search.map');
      return;
    }

    var appSettings = SettingsFactory.get();

    // View Model
    var vm = this;

    // Exposed to the view
    vm.credentials = {};
    vm.step = 1;
    vm.isLoading = false;
    vm.submitSignup = submitSignup;
    vm.openRules = openRules;
    vm.tribe = null;
    vm.suggestedTribes = [];
    vm.suggestionsLimit = 3; // How many tribes suggested (including possible referred tribe)

    // Variables for invitation feature
    vm.invitationCode = $stateParams.code || '';
    vm.invitationCodeValid = false;
    vm.invitationCodeError = false;
    vm.validateInvitationCode = validateInvitationCode;
    vm.isWaitingListEnabled = false;
    vm.waitinglistInvitation = Boolean($stateParams.mwr);

    // Initialize controller
    activate();


    /**
     * Initalize controller
     */
    function activate() {
      // If invitation code was passed to the page (via URL), validate it
      validateInvitationCode()
        .finally(function() {
          // Initialise waitinglist
          initWaitingList();
        });

      // Get list of suggested tribes
      initSuggstedTribes();
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
          tribeSlug: $stateParams.tribe
        })
        .then(function(tribe) {

          // Got it
          if (tribe._id) {
            vm.tribe = tribe;
            // Show one less suggestion since we have referred tribe
            vm.suggestionsLimit--;
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
      TribesService.query({
        // If we have referred tribe, load one extra suggestion in case we load referred tribe among suggestions
        limit: (vm.tribe ? (parseInt(vm.suggestionsLimit + 1, 10)) : vm.suggestionsLimit)
      },
      function(tribes) {
        var suggestedTribes = [];

        // Make sure to remove referred tribe from suggested tribes so that we won't have dublicates
        // We'll always show 2 or 3 of these at the frontend depending on if referred tribe is shown.
        if (withoutTribeId) {
          angular.forEach(tribes, function(suggestedTribe) {
            if (suggestedTribe._id !== withoutTribeId) {
              // eslint-disable-next-line angular/controller-as-vm
              this.push(suggestedTribe);
            }
          }, suggestedTribes);
          vm.suggestedTribes = suggestedTribes;
        } else {
          vm.suggestedTribes = tribes;
        }
      });
    }

    /**
     * Register
     */
    function submitSignup() {
      vm.isLoading = true;

      $http
        .post('/api/auth/signup', vm.credentials)
        .then(
          function(newUser) { // On success function

            // If there is referred tribe, add user to that next up
            if (vm.tribe && vm.tribe._id) {
              UserMembershipsService.post({
                id: vm.tribe._id,
                relation: 'is'
              },
              function(data) {
                updateUser(data.user || newUser.data);
                vm.isLoading = false;
                vm.step = 2;
              });
            } else {
              // No tribe to join, just continue
              updateUser(newUser.data);
              vm.isLoading = false;
              vm.step = 2;
            }
          },
          function(error) { // On error function
            vm.isLoading = false;
            messageCenterService.add('danger', error.data.message || 'Something went wrong.');
          }
        );
    }

    /**
     * Validate invitation code
     * Invite code has to be present at `vm.invitationCode`
     */
    function validateInvitationCode() {
      var deferred = $q.defer();

      vm.invitationCodeError = false;

      if (vm.invitationCode) {
        // Validate code
        InvitationService.post({
          invitecode: vm.invitationCode
        }).$promise.then(function(data) {

          // UI
          vm.invitationCodeValid = data.valid;
          vm.invitationCodeError = !data.valid;

          // Resolve promise
          deferred.resolve();

          // Analytics
          if (data.valid) {
            $analytics.eventTrack('invitationCode.valid', {
              category: 'invitation',
              label: 'Valid invitation code entered'
            });
          } else {
            $analytics.eventTrack('invitationCode.invalid', {
              category: 'invitation',
              label: 'Invalid invitation code entered'
            });
          }
        }, function() {
          vm.invitationCodeValid = false;
          vm.invitationCodeError = true;

          // Reject promise
          deferred.reject();

          messageCenterService.add('danger', 'Something went wrong, try again.');
          $analytics.eventTrack('invitationCode.failed', {
            category: 'invitation',
            label: 'Failed to validate invitation code'
          });
        });
      } else {
        // No invite code available, just resolve promise
        deferred.resolve();
      }

      return deferred.promise;
    }

    /**
     * Initialize waiting list
     * @link https://maitreapp.co
     */
    function initWaitingList() {

      // Don't proceed if no invitations enabled,
      // or no Maitre id available
      // or if valid invite code was already given
      if (!appSettings.invitationsEnabled ||
          !appSettings.maitreId ||
          vm.invitationCodeValid) {
        return;
      }

      // Either store `mwr` URL parameter to localStorage
      // or pick it up from localStorage and put it back to URL
      // `mwr` is a Maitre invite parameter
      if (locker.supported()) {
        var mwrLockerKey = 'waitinglist.mwr';
        // If `mwr` attribute is in the URL...
        if ($stateParams.mwr) {
          // ...store it in local storage
          locker.put(mwrLockerKey, $stateParams.mwr);
          $analytics.eventTrack('waitinglist.enabled', {
            category: 'waitinglist',
            label: 'Waiting list invitation code enabled'
          });
        // If previously stored `mwr` is available in locker...
        } else if (locker.get(mwrLockerKey)) {
          // ...put it back to the URL
          // This route has `reloadOnSearch:false` configured so it won't
          // reload the view
          // See modules/users/client/config/users.client.routes.js
          $location.search('mwr', locker.get(mwrLockerKey));
          vm.waitinglistInvitation = true;
          $analytics.eventTrack('waitinglist.re-enabled', {
            category: 'waitinglist',
            label: 'Waiting list invitation code re-enabled'
          });
        }
      }

      vm.isWaitingListEnabled = true;

      // If page was opened via waiting list invitation,
      // scroll to the right place on page
      if (vm.waitinglistInvitation) {
        $location.hash('waitinglist');
      }

      // Maitre configuration
      // @link http://support.maitreapp.co/article/56-configuration
      $window.Maitre = {
        uuid: appSettings.maitreId,

        // Show/hide name field in the form.
        require_name: false,

        // When "test_mode" is set to true,
        // neither views nor registrations will be saved.
        test_mode: Boolean($window.env !== 'production'),

        // `true`: show list of waiting up users
        // `false`: show number of waiting users
        require_leaderboard: false
      };

      // Initialize Maitre app by appending script to the page
      // Expects an element with `data-maitre` be present in DOM
      // https://api.jquery.com/jQuery.getScript/
      jQuery.getScript('https://maitreapp.co/widget.js')
        .fail(function() {
          // If loading the script fails, hide waiting list feature
          vm.isWaitingListEnabled = false;

          // Send event to analytics
          $analytics.eventTrack('waitinglist.failed', {
            category: 'waitinglist',
            label: 'Waiting list script failed to load.'
          });
        });

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
        templateUrl: '/modules/users/views/authentication/rules-modal.client.view.html'
      });

      // Record event to analytics
      $analytics.eventTrack('signup.rules.open', {
        category: 'signup',
        label: 'Open rules from signup form'
      });
    }

  }

}(jQuery));
