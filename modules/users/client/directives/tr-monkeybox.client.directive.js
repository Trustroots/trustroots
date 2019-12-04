(function () {
  /**
   * Monkeybox directive to show a simple profile info box
   */
  angular
    .module('users')
    .directive('trMonkeybox', trMonkeyboxDirective);

  /* @ngInject */
  function trMonkeyboxDirective() {
    return {
      templateUrl: '/modules/users/views/directives/tr-monkeybox.client.view.html',
      restrict: 'A',
      replace: true,
      scope: {
        profile: '='
      },
      controller: ['$scope', 'Languages', function ($scope, Languages) {

        $scope.languageNames = Languages.get('object');

      }]
    };
  }
}());
