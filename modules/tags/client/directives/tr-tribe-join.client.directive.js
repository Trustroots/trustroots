(function () {
  'use strict';

  /**
   * Join tribe
   */
  angular
    .module('tags')

    .directive('trTribeJoin', trTribeJoinDirective);

  /* @ngInject */
  function trTribeJoinDirective() {
    return {
      restrict: 'A',
      scope: false,
      controller: trTribeJoinDirectiveController,
      controllerAs: 'tribeJoinDirective'
    };

    /* @ngInject */
    function trTribeJoinDirectiveController($q, $rootScope, $scope, $state, $analytics, $confirm, TribeService, UserTagsService, Authentication, messageCenterService) {

      // View Model
      var vm = this;

      vm.toggleMembership = toggleMembership;
      vm.openTribe = openTribe;
      vm.tribeSignup = tribeSignup;
      vm.isMember = false;

      activate();

      /**
       * Initialize directive
       */
      function activate() {
        // Check if authenticated user is already a member
        if (Authentication.user) {
          checkIsMember();
        }
      }

      /**
       * Open tribe
       */
      function openTribe() {
        // Put tribe object to `$rootScope` to be used after
        // page transition has finished
        TribeService.fillCache(angular.copy($scope.tribe));
        $state.go('tribes.tribe', { 'tribe': $scope.tribe.slug });
      }

      /**
       * Go to signup page and refer to this tribe
       */
      function tribeSignup() {
        TribeService.fillCache(angular.copy($scope.tribe));
        $state.go('signup', { 'tribe': $scope.tribe.slug });
      }

      /**
       * Toggle membership (join or leave)
       */
      function toggleMembership() {
        // Authentication.user.memberIds = angular.copy(Authentication.user.memberIds);
        vm.isMember = !vm.isMember;
        return (vm.isMember) ? join() : leave();
      }

      /**
       * Join Tribe
       */
      function join() {
        // Tracking
        $analytics.eventTrack('join-tribe', {
          category: 'tribes.membership',
          label: 'Join tribe',
          value: $scope.tribe.slug
        });

        return $q(function(resolve, reject) {
          UserTagsService.post({
            id: $scope.tribe._id,
            relation: 'is'
          },
          function(data) {
            if (data.tag && data.user) {
              vm.isMember = true;
              data.tag.$resolved = true;
              $scope.tribe = data.tag;
              Authentication.user = data.user;
              $rootScope.$broadcast('userUpdated');
              resolve(true);
            } else {
              toggleMembershipError();
              vm.isMember = false;
              reject(false);
            }
          }, function() {
            toggleMembershipError();
            vm.isMember = false;
            reject(false);
          });
        });
      }

      /**
       * Leave tribe
       */
      function leave() {
        // Tracking
        $analytics.eventTrack('leave-tribe', {
          category: 'tribes.membership',
          label: 'Leave tribe',
          value: $scope.tribe.slug
        });

        return $q(function(resolve, reject) {

          // Ask user for confirmation
          $confirm({
            title: 'Leave this Tribe?',
            text: 'Do you want to leave ' + $scope.tribe.label + '?',
            ok: 'Leave Tribe',
            cancel: 'Cancel'
          })
          .then(function() {
            UserTagsService.post({
              id: $scope.tribe._id,
              relation: 'leave'
            },
            function(data) {
              if (data.tag && data.user) {
                // API success
                vm.isMember = false;
                data.tag.$resolved = true;
                $scope.tribe = data.tag;
                Authentication.user = data.user;
                $rootScope.$broadcast('userUpdated');
                resolve(false);
              } else {
                // API returned error
                toggleMembershipError();
                vm.isMember = true;
                reject(true);
              }
            }, function() {
              // API returned error
              toggleMembershipError();
              vm.isMember = true;
              reject(true);
            });
          },
          // `Cancel` button from confirm dialog
          function() {
            $analytics.eventTrack('leave-tribe-cancelled', {
              category: 'tribes.membership',
              label: 'Leaving tribe cancelled',
              value: $scope.tribe.slug
            });
            vm.isMember = true;
            reject(true);
          });

        });
      }

      /**
       * On API error when joinin or leaving a tribe
       */
      function toggleMembershipError() {
        messageCenterService.add('danger', 'Something went wrong. Please try again.');
      }

      /**
       * Check if currently authenticated user is member of this tribe
       */
      function checkIsMember() {
        if (!Authentication.user || !Authentication.user.memberIds || !Authentication.user.memberIds.length) {
          // Array or user missing, cannot be a member of anything
          vm.isMember = false;
        } else {
          // Is this tribe's id among member's tags/tribes ids?
          vm.isMember = Authentication.user.memberIds.indexOf($scope.tribe._id) > -1;
        }
      }

    }

  }

}());
