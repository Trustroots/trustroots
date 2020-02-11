/**
 * Print out credits for photos used at the page by tr-boards directive
 */
angular.module('core').directive('trBoardCredits', trBoardCreditsDirective);

/* @ngInject */
function trBoardCreditsDirective() {
  return {
    template:
      '<span class="boards-credits" ng-if="app.photoCreditsCount">' +
      '  <span ng-if="app.photoCreditsCount === 1">Photo by</span>' +
      '  <span ng-if="app.photoCreditsCount > 1">Photos by</span>' +
      '   <span ng-repeat="(key, credit) in app.photoCredits track by key">' +
      '    <a ng-href="{{ credit.url }}" ng-bind="credit.name" rel="noopener"></a>' +
      '    <span ng-if="credit.license"> (<a ng-href="{{ credit.license_url }}" ng-bind-html="credit.license" title="License" rel="license noopener" aria-label="License"></a>)</span>' +
      '    <span ng-if="($first && app.photoCreditsCount > 1) || $middle">, </span>' +
      '  </span>' +
      '</span>',
    restrict: 'A',
  };
}
