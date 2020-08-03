import templateUrl from '@/modules/tribes/client/views/directives/tr-tribe-join-button.client.view.html';

/**
 * Join tribe button
 */
angular
  .module('tribes')
  .directive('trTribeJoinButton', trTribeJoinButtonDirective);

/* @ngInject */
function trTribeJoinButtonDirective() {
  return {
    restrict: 'AE',
    replace: true,
    transclude: true,
    scope: {
      tribe: '=',
      joinLabel: '=',
      joinedLabel: '=',
      icon: '=',
    },
    templateUrl,
    controller: trTribeJoinButtonDirectiveController,
    controllerAs: 'tribeJoinButton',
  };

  /* @ngInject */
  function trTribeJoinButtonDirectiveController(
    $q,
    $confirm,
    $scope,
    $state,
    $rootScope,
    $analytics,
    Authentication,
    TribeService,
    UserMembershipsService,
    messageCenterService,
  ) {
    const vm = this;

    vm.tribe = $scope.tribe;
    vm.isMember = false;
    vm.isLoading = false;
    vm.joinLabel = $scope.joinLabel || 'Join';
    vm.joinedLabel = $scope.joinedLabel || 'Joined';
    vm.icon = Boolean($scope.icon);

    vm.toggleMembership = toggleMembership;

    activate();

    /**
     * Initialize directive
     */
    function activate() {
      // Check if authenticated user is already a member
      if (Authentication.user) {
        vm.isMember =
          Authentication.user &&
          Authentication.user.memberIds &&
          Authentication.user.memberIds.indexOf(vm.tribe._id) > -1;
      }
    }

    /**
     * Go to signup page and refer to this tribe
     */
    function tribeSignup() {
      TribeService.fillCache(angular.copy(vm.tribe));
      $state.go('signup', { tribe: vm.tribe.slug });
    }

    /**
     * Toggle membership (join or leave)
     */
    function toggleMembership() {
      if (vm.isLoading) {
        return;
      }

      vm.isLoading = true;

      // If user is not authenticated, redirect them to signup page
      if (!Authentication.user) {
        return tribeSignup();
      }

      // Join tribe
      if (!vm.isMember) {
        return join()
          .then(function (data) {
            vm.isMember = true;

            applyChangedData(data);

            $analytics.eventTrack('join-tribe', {
              category: 'tribes.membership',
              label: 'Join circle',
              value: $scope.tribe.slug,
            });
          })
          .catch(function () {
            messageCenterService.add(
              'danger',
              'Failed to join the circle. Try again!',
            );
          })
          .finally(function () {
            vm.isLoading = false;
          });
      }

      // Leave tribe
      leave()
        .then(function (data) {
          vm.isMember = false;

          applyChangedData(data);

          $analytics.eventTrack('leave-tribe', {
            category: 'tribes.membership',
            label: 'Leave circle',
            value: $scope.tribe.slug,
          });
        })
        .catch(function (err) {
          if (err === 'cancelled') {
            $analytics.eventTrack('leave-tribe-cancelled', {
              category: 'tribes.membership',
              label: 'Leaving circle cancelled',
              value: $scope.tribe.slug,
            });
            return;
          }

          const errorMessage =
            err && err.data && err.data.message
              ? err.data.message
              : 'Failed to leave the circle. Try again!';
          messageCenterService.add('danger', errorMessage);
        })
        .finally(function () {
          vm.isLoading = false;
        });
    }

    /**
     * Join Tribe
     */
    function join() {
      return $q(function (resolve, reject) {
        UserMembershipsService.post(
          {
            tribeId: $scope.tribe._id,
          },
          function (data) {
            if (data.tribe && data.user) {
              data.tribe.$resolved = true;

              resolve(data);
            } else {
              reject();
            }
          },
          function (err) {
            reject(err);
          },
        );
      });
    }

    /**
     * Leave tribe
     */
    function leave() {
      return $q(function (resolve, reject) {
        // Ask user for confirmation
        $confirm({
          title: 'Leave this circle?',
          text: 'Do you want to leave "' + $scope.tribe.label + '"?',
          ok: 'Leave circle',
          cancel: 'Cancel',
        }).then(
          function () {
            UserMembershipsService.delete(
              {
                tribeId: $scope.tribe._id,
              },
              function (data) {
                if (data.tribe && data.user) {
                  // API success
                  data.tribe.$resolved = true;

                  resolve(data);
                } else {
                  // API returned error
                  reject();
                }
              },
              function (err) {
                // API returned error
                reject(err);
              },
            );
          },
          // `Cancel` button from confirm dialog
          function () {
            reject('cancelled');
          },
        );
      });
    }

    function applyChangedData(data) {
      // Update tribe with new count
      if (data.tribe) {
        $scope.tribe = data.tribe;
        $rootScope.$broadcast('tribeUpdated', data.tribe);
      }

      // User model is updated with new tribe data
      if (data.user) {
        Authentication.user = data.user;
        $rootScope.$broadcast('userUpdated');
      }
    }
  }
}
