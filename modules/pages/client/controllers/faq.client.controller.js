(function () {
  angular
    .module('pages')
    .controller('FaqController', FaqController);

  /* @ngInject */
  function FaqController($scope, $timeout, $window, $location, $state, $uiViewScroll) {

    // ViewModel
    const vm = this;

    // Exposed to the view
    vm.allowStickySidebar = true;

    activate();

    /**
     * Initialize
     */
    function activate() {

      // Follow on which FAQ category we are at
      $scope.$on('$stateChangeSuccess', function () {
        if ($state.current.name.substr(0, 4) === 'faq.') {
          vm.category = $state.current.name.replace('faq.', '');
          canSidebarBeSticky();
        }
      });

      // Act when hash changes
      $scope.$on('$locationChangeSuccess', function () {
        if ($location.hash() !== '') {
          highlightQuestion($location.hash());
        }
      });

      // Determine sidebar's stickiness
      canSidebarBeSticky();

      $timeout(function () {

        // If hash is present on initial page load, open it
        if ($location.hash() !== '') {
          // Scroll to element
          $uiViewScroll(angular.element('#' + $location.hash()));
          highlightQuestion($location.hash());
        }

        // Determine fixed width for the sidebar so it doesn't overflow when it gets fixed position
        angular.element('#faq-sidebar').css({ 'width': angular.element('#faq-sidebar').width() });
      });

    }

    /**
     * Determine if sidebar should be scrolling or not
     * If window height is smaller than sidebar's height,
     * don't let it stick
     */
    function canSidebarBeSticky() {
      $timeout(function () {
        if ($window.innerHeight <= angular.element('#faq-sidebar').height()) {
          vm.allowStickySidebar = false;
        }
      });
    }

    /**
     * Scroll+highlight a FAQ question when clicking title at sidebar
     */
    function highlightQuestion(id) {
      const $el = angular.element('#' + id);

      // Performs color flash for link, see faq.less for more.
      // Animation time at CSS is 1000ms
      if ($el.length) {
        $el.addClass('faq-question-flash');
        $timeout(function () {
          $el.removeClass('faq-question-flash');
        }, 1010);
      }
    }

  }
}());
