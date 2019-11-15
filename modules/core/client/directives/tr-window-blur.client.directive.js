(function () {
  /**
   * Directive to watch window blur events.
   * See also `tr-window-focus.client.directive.js`
   *
   * Usage:
   * `<body tr-window-blur="doSomething()">`
   *
   * Based on
   * @link http://www.bennadel.com/blog/2934-handling-window-blur-and-focus-events-in-angularjs.htm
   */
  angular
    .module('core')
    .directive('trWindowBlur', trWindowBlurDirective);

  /* @ngInject */
  function trWindowBlurDirective($window) {
    var directive = {
      link: link,
      restrict: 'A'
    };

    return directive;

    function link(scope, element, attributes) {

      // Hook up blur-handler
      var win = angular.element($window).on('blur', handleBlur);

      // When the scope is destroyed, we have to make sure to teardown
      // the event binding so we don't get a leak.
      scope.$on('$destroy', handleDestroy);

      // Handle the blur event on the Window.
      function handleBlur() {
        scope.$apply(attributes.trWindowBlur);
      }

      // Teardown the directive.
      function handleDestroy() {
        win.off('blur', handleBlur);
      }

    }
  }
}());
