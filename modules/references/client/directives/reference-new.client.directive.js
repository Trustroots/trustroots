(function () {
  'use strict';

  /**
   * References-new directive widget for leaving a reference to user
   *
   * Usage:
   *
   * ```
   * <div tr-references-new="userToProfile"></div>
   * ```
   *
   * `userToProfile` should contain `_id` and optionally `member` array for tribes.
   *
   * userToId: feedback receiver's id
   */
  angular
    .module('references')
    .directive('trReferenceNew', trReferenceNewDirective);

  /* @ngInject */
  function trReferenceNewDirective() {
    var directive = {
      restrict: 'A',
      replace: true,
      templateUrl: '/modules/references/views/directives/tr-reference-new.client.view.html',
      scope: {
        userTo: '=user'
      },
      controller: trReferenceNewDirectiveController,
      controllerAs: 'referenceNew'
      // bindToController: true // because the scope is isolated
    };

    return directive;
  }

  // Note: Note that the directive's controller is outside the directive's closure.
  // This style eliminates issues where the injection gets created as unreachable code after a return.
  /* @ngInject */
  function trReferenceNewDirectiveController(
    $scope,
    $analytics,
    Authentication,
    messageCenterService,
    ReferencesService,
    SettingsFactory,
    SupportService
  ) {

    // View Model
    var vm = this;

    // Exposed to the view
    vm.appSettings = SettingsFactory.get();
    vm.userTo = $scope.userTo;
    vm.onHowDoIKnowThemChanged = onHowDoIKnowThemChanged;
    // vm.onWeLiveTogetherChanged = onWeLiveTogetherChanged;
    vm.onRecommendChange = onRecommendChange;
    vm.onDeselectTab = onDeselectTab;
    vm.nextTab = nextTab;
    vm.previousTab = previousTab;
    vm.submit = submit;
    vm.endorse = endorse;
    vm.isEndorsingNone = false;
    vm.unsavedModifications = false;
    vm.existingReference = false;
    vm.howDoIKnowThemWarning = false;
    vm.recommendationWarning = false;
    vm.referenceUserTab = 0;
    vm.endorsedTribes = [];
    vm.endorsementLimit = 3; // Max number of endorsements allowed per reference
    vm.livingTogether = false;
    vm.recommendationQuestion = 'met'; // met | hosted_me | hosted_them
    vm.isLoading = false;
    vm.reference = {
      met: false,
      hosted_me: false,
      hosted_them: false,
      recommend: '', // yes | no | unknown | ''
      feedback_private: '',
      feedback: ''
    };
    vm.report = false;
    vm.reportMessage = '';

    activate();

    /**
     * Activate controller
     */
    function activate() {

      // Look up existing reference from the API
      if (vm.userTo && vm.userTo._id) {
        vm.isLoading = true;
        ReferencesService.query({
          userFromId: Authentication.user._id,
          userToId: vm.userTo._id
        }, function (reference) {
          vm.isLoading = false;
          if (reference) {
            vm.reference = reference;
          }
        }, function () {
          vm.isLoading = false;
        });
      }
    }

    /**
     * Activate next tab
     */
    function nextTab() {

      // If they didn't have interraction, you shouldn't be able to leave references
      if (! vm.reference.met && ! vm.reference.hosted_me && ! vm.reference.hosted_them) {
        vm.howDoIKnowThemWarning = true;
        return;
      }

      // Choosing recommendation is mandatory
      if (vm.referenceUserTab === 1 && vm.reference.recommend === '') {
        vm.recommendationWarning = true;
        return;
      }

      // Reset warnings
      vm.howDoIKnowThemWarning = false;
      vm.recommendationWarning = false;

      var next = vm.referenceUserTab + 1;


      // Skip the tribes tab (2) if user didn't recommend them
      // Skip also if feature is disabled
      if ((!vm.appSettings.featureFlags.referenceTribeEndorsements || vm.reference.recommend === 'no') && next === 2) {
        next++;
      }

      vm.referenceUserTab = next;
    }

    /**
     * Activate previous tab
     */
    function previousTab() {
      var previous = vm.referenceUserTab - 1;
      // Skip the tribes tab (2) if user didn't recommend them
      // Skip also if feature is disabled
      if ((!vm.appSettings.featureFlags.referenceTribeEndorsements || vm.reference.recommend === 'no') && previous === 2) {
        previous--;
      }
      vm.referenceUserTab = previous;
    }

    /**
     * Endorse (or un-endorse) a tribe
     */
    function endorse(membership) {
      vm.isEndorsingNone = false;
      membership.endorse = !membership.endorse;

      if (angular.isUndefined(membership.endorsements)) {
        membership.endorsements = 0;
      }

      if (membership.endorse) {
        membership.endorsements++;

        // Add tribe ID to array
        vm.endorsedTribes.push(membership.tribe._id);
      } else {
        membership.endorsements--;

        // Remove tribe ID from array
        var index = vm.endorsedTribes.indexOf(membership.tribe._id);
        if (index !== -1) vm.endorsedTribes.splice(index, 1);
      }
    }

    /**
     * Don't let tab selection for tabs whcih come later than current tab
     */
    function onDeselectTab($event, selectedIndex, previousIndex) {
      if ($event && previousIndex < selectedIndex) {
        $event.preventDefault();
      }
    }

    /**
     * Hop automatically to the next tab when choosing "yes" or "don't know"
     * in recommendation question
     */
    function onRecommendChange() {
      // Continue to next step
      if (vm.reference.recommend !== 'no') {
        nextTab();
      }
    }

    /*
    function onWeLiveTogetherChanged() {
      vm.reference.met = vm.livingTogether ? vm.livingTogether : vm.reference.met;
    }
    */

    /**
     * Sets question for asking the `recommend` value
     *
     * When someone is hosting you (`hosted_me`), you're most vurnerable.
     * Thus this preference drives over others.
     */
    function onHowDoIKnowThemChanged() {
      vm.howDoIKnowThemWarning = false;

      // In case user came back and changed these values,
      // we want to re-ask recommendation question, too.
      vm.reference.recommend = '';

      if (vm.reference.hosted_me) {
        vm.recommendationQuestion = 'hosted_me';
      } else if (vm.reference.hosted_them) {
        vm.recommendationQuestion = 'hosted_them';
      } else {
        vm.recommendationQuestion = 'met';
      }
    }

    /**
     * Send reference (and possible support request) to the API
     */
    function submit() {
      var newReference = new ReferencesService(angular.extend(
        {
          userToId: vm.userTo._id,
          endorsedTribes: vm.endorsedTribes
        },
        vm.reference
      ));

      newReference.$save(function (response) {
        console.log(response);
        messageCenterService.add('success', 'Thank you!');
      }, function () {
        messageCenterService.add('danger', 'Something went wrong. Please try again.');
      });

      // Send possible support message if they want to report this user
      if (vm.report) {
        var reportMessage = vm.reportMessage
          + '\n\n'
          + 'Sent via reference form.';
        var report = new SupportService({
          username: vm.userTo.username || '',
          message: reportMessage || ''
        });
        report.$save(function (response) {
          console.log(response);
        }, function (err) {
          console.log(err);
        });
      }

    }

  }

}());
