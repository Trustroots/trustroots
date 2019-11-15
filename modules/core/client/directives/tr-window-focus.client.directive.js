(function () {
  /**
   * Directive to watch window blur events.
   * See also `tr-window-blur.client.directive.js`
   *
   * Usage:
   * `<body tr-window-focus="doSomething()">`
   *
   * Based on
   * @link http://www.bennadel.com/blog/2934-handling-window-blur-and-focus-events-in-angularjs.htm
   */
  angular
    .module('core')
    .directive('trWindowFocus', trWindowFocusDirective);

  /* @ngInject */
  function trWindowFocusDirective($window) {
    var directive = {
      link: link,
      restrict: 'A'
    };

    return directive;

    function link(scope, element, attributes) {

      // Hook up focus-handler
      var win = angular.element($window).on('focus', handleFocus);

      // When the scope is destroyed, we have to make sure to teardown
      // the event binding so we don't get a leak.
      scope.$on('$destroy', handleDestroy);

      // Handle the focus event on the Window
      function handleFocus() {
        scope.$apply(attributes.trWindowFocus);
      }

      // Teardown the directive
      function handleDestroy() {
        win.off('focus', handleFocus);
      }

    }
  }
}());
