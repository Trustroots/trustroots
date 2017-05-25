(function () {
  'use strict';

  angular
    .module('users')
    .controller('SignupController', SignupController);

  /* @ngInject */
  function SignupController($rootScope, $log, $http, $state, $stateParams, $uibModal, $analytics, Authentication, UserMembershipsService, messageCenterService, TribeService, TribesService, InvitationService) {

    // View Model
    var vm = this;

    vm.credentials = {};
    vm.step = 1;
    vm.isLoading = false;
    vm.submitSignup = submitSignup;
    vm.openRules = openRules;
    vm.tribe = null;
    vm.suggestedTribes = [];
    vm.suggestionsLimit = 3; // How many tribes suggested (including possible referred tribe)

    // Variables for invitation feature
    vm.invitationCode = '';
    vm.invitationCodeValid = false;
    vm.invitationCodeError = false;
    vm.validateInvitationCode = validateInvitationCode;

    activate();

    /**
     * Validate invitation code
     */
    function validateInvitationCode() {
      vm.invitationCodeError = false;

      // Validate code
      InvitationService.post({
        invitecode: vm.invitationCode
      }).$promise.then(function(data) {
        $log.log(data);
        $log.log(data.valid);

        // UI
        vm.invitationCodeValid = data.valid;
        vm.invitationCodeError = !data.valid;

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
        messageCenterService.add('danger', 'Something went wrong, try again.');
        $analytics.eventTrack('invitationCode.failed', {
          category: 'invitation',
          label: 'Failed to validate invitation code'
        });
      });

    }


    /**
     * Initalize controller
     */
    function activate() {

      // If user is already signed in then redirect to search page
      if (Authentication.user) {
        $state.go('search.map');
        return;
      }

      // Fetch information about referred tribe
      if ($stateParams.tribe && $stateParams.tribe !== '') {
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

          // Fetch suggested tribes without this tribe
          getSuggestedTribes(tribe._id || null);

        });
      } else {
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
      $uibModal.open({
        templateUrl: '/modules/users/views/authentication/rules-modal.client.view.html'
      });
    }

  }

}());
