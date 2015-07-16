(function(){
  'use strict';

  /**
   * Directive preventing hotnail.com etc errors
   * Requires jQuery
   */
  angular
    .module('core')
    .directive('trMailcheck', trMailcheckDirective);

  /* @ngInject */
  function trMailcheckDirective($compile, $sce) {
    return {
      restrict: 'A',
      replace: false,
      link: function(scope, el, attrs, ngModel) {

        scope.suggestion = false;
        scope.bugmenot = false;

        // Compiled template
        // after() requires jQuery
        var template = $compile('<div class="help-block" ng-show="suggestion && !bugmenot">Did you mean <a ng-bind="suggestion" ng-click="useSuggestion()" tooltip="Yes! Change to this please." tooltip-placement="bottom"></a>? <a ng-click="suggestion=false;bugmenot=true">Nope.</a></div>')(scope);
        el.after(template);

        el.bind('input', function() {
            scope.suggestion = false;
          })
          .bind('blur', function() {
            el.mailcheck({
              suggested: function(element, suggestion) {
                scope.suggestion = suggestion.full;
                scope.$apply();
              },
              empty: function(element) {
                scope.suggestion = false;
              }
            });
          });

        scope.useSuggestion = function() {
          el.val(scope.suggestion);
          scope.suggestion = false;
        };

      }
    };
  }

})();
