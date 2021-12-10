angular.module('core').directive('trPageTitle', trPageTitle);

/* @ngInject */
function trPageTitle($rootScope, $interpolate, $state, $window) {
  const directive = {
    restrict: 'A',
    link,
  };

  return directive;

  function link(scope, element) {
    $rootScope.$on('$stateChangeSuccess', listener);

    function listener(event, toState) {
      if (toState.data && toState.data.pageTitle) {
        const stateTitle = $interpolate(toState.data.pageTitle)(
          $state.$current.locals.globals,
        );
        element.html(stateTitle + ' - Trustroots');
      } else {
        element.html($window.title);
      }
    }
  }
}
