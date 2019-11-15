(function () {
  angular.module('core')
    .directive('trPageTitle', trPageTitle);

  /* @ngInject */
  function trPageTitle($rootScope, $interpolate, $state, $window) {
    var directive = {
      restrict: 'A',
      link: link
    };

    return directive;

    function link(scope, element) {
      $rootScope.$on('$stateChangeSuccess', listener);

      function listener(event, toState) {
        if (toState.data && toState.data.pageTitle) {
          var stateTitle = $interpolate(toState.data.pageTitle)($state.$current.locals.globals);
          element.html(stateTitle + ' - Trustroots');
        } else {
          element.html($window.title);
        }
      }
    }
  }
}());
