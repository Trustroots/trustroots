(function(){
  'use strict';

  /**
   * Directive that simply Adds a helper text under the input and shows/hides it on focus/blur
   *
   * Usage:
   * <input tr-focustip="'Text to appear under input'" type="text">
   */
  angular
    .module('core')
    .directive('trFocustip', trFocustipDirective);

  /* @ngInject */
  function trFocustipDirective($compile, $timeout) {
    return {
      restrict: 'A',
      replace: false,
      scope: {
        trFocustip: '='
      },
      link: function(scope, el, attrs, ctrl) {

        // Compiled template
        // after() requires jQuery
        var template = $compile('<div class="help-block" ng-show="enabled">' + scope.trFocustip + '</div>')(scope);
        el.after(template);

        el.bind('focus', function() {
            // Enable only if there's some text to show
            scope.enabled = (angular.isString(scope.trFocustip) && scope.trFocustip !== '');
            scope.$apply();
          })
          .bind('blur', function() {
            scope.enabled = false;
            scope.$apply();
          });

      }
    };
  }

})();
