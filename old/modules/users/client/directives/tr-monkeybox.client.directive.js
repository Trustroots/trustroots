import templateUrl from '@/modules/users/client/views/directives/tr-monkeybox.client.view.html';

/**
 * Monkeybox directive to show a simple profile info box
 */
angular.module('users').directive('trMonkeybox', trMonkeyboxDirective);

/* @ngInject */
function trMonkeyboxDirective() {
  return {
    templateUrl,
    restrict: 'A',
    replace: true,
    scope: {
      profile: '=',
    },
    controller: [
      '$scope',
      'Languages',
      function ($scope, Languages) {
        $scope.languageNames = Languages.get('object');
      },
    ],
  };
}
