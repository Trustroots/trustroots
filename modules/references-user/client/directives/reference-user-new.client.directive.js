(function () {
  'use strict';

  /**
   * References-user-new directive widget for leaving a reference to user
   *
   * Usage:
   *
   * ```
   * <div tr-references-user-new="userToId"></div>
   * ```
   *
   * userToId: feedback receiver's id
   */
  angular
    .module('references-user')
    .directive('trReferenceUserNew', trReferenceUserNewDirective);

  /* @ngInject */
  function trReferenceUserNewDirective() {
    var directive = {
      restrict: 'A',
      replace: true,
      templateUrl: '/modules/references-user/views/directives/tr-reference-user-new.client.view.html',
      scope: {
        trReferenceUserNew: '=',
        memberships: '='
      },
      controller: trReferenceUserNewDirectiveController,
      controllerAs: 'vm',
      bindToController: true // because the scope is isolated
    };

    return directive;
  }

  // Note: Note that the directive's controller is outside the directive's closure.
  // This style eliminates issues where the injection gets created as unreachable code after a return.
  /* @ngInject */
  function trReferenceUserNewDirectiveController($scope, $analytics, messageCenterService, ReferenceThreadService) {

    // View Model
    var vm = this;

    console.log(vm);

    // Exposed to the view
    vm.userTo = vm.trReferenceUserNew;
    vm.createReference = createReference;
    vm.onHowDoIKnowThemChanged = onHowDoIKnowThemChanged;
    // vm.onWeLiveTogetherChanged = onWeLiveTogetherChanged;
    vm.onRecommendChange = onRecommendChange;
    vm.onDeselectTab = onDeselectTab;
    vm.nextTab = nextTab;
    vm.previousTab = previousTab;
    vm.unsavedModifications = false;
    vm.existingReference = false;
    vm.howDoIKnowThemWarning = false;
    vm.recommendationWarning = false;
    vm.referenceUserTab = 0;
    vm.reference = {
      met: false,
      hosted_me: false,
      hosted_them: false,
      recommend: ''
    };
    vm.living_together = false;
    vm.recommendationQuestion = 'met'; // met | hosted_me | hosted_them
    vm.isLoading = true;

    activate();

    /**
     * Activate controller
     */
    function activate() {

      vm.isLoading = false;
      /*
      // Look up existing reference from the API
      ReferenceThreadService.get({
        userToId: vm.userTo
      }, function (referenceThread) {
        vm.isLoading = false;
        if (referenceThread) {
          vm.allowCreatingReference = true;
          vm.reference = referenceThread;
        }
      }, function (referenceThreadErr) {
        vm.isLoading = false;
        // In case of 404, API will tell us if we are allowed to send references to this user
        vm.allowCreatingReference = (referenceThreadErr.data && angular.isDefined(referenceThreadErr.data.allowCreatingReference)) ? Boolean(referenceThreadErr.data.allowCreatingReference) : false;
      });
      */
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
      if (vm.reference.recommend === 'no' && next === 2) {
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
      if (vm.reference.recommend === 'no' && previous === 2) {
        previous--;
      }
      vm.referenceUserTab = previous;
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
      vm.reference.met = vm.living_together ? vm.living_together : vm.reference.met;
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
     * Send reference to the API
     */
    function createReference(reference) {
      var newReference = new ReferenceThreadService({
        userTo: vm.userTo,
        reference: String(reference)
      });

      vm.reference = newReference;

      newReference.$save(function (response) {
        vm.reference = response;
        messageCenterService.add('success', 'Thank you!');
      }, function () {
        vm.reference = false;
        messageCenterService.add('danger', 'Something went wrong. Please try again.');
      });
    }

  }

}());
