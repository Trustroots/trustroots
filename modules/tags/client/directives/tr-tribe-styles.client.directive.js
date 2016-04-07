(function() {
  'use strict';

  /**
   * Directive to apply tribe color + image styles to an element
   */
  angular
    .module('tags')
    .directive('trTribeStyles', trTribeStylesDirective);

  /* @ngInject */
  function trTribeStylesDirective() {
    return {
      restrict: 'A',
      replace: false,
      scope: false,
      link: function(scope, elem, attrs) {

        if(angular.isDefined(attrs.trTribeStyles) && attrs.trTribeStyles !== '') {
          var style = '',
              tribe = angular.fromJson(attrs.trTribeStyles);

          if(tribe.image && tribe._id) {
            style += 'background-image: url(/modules/tags/img/tribe/' + tribe._id.toString() + '.jpg);';
          }

          if(tribe.color) {
            style += 'background-color: #' + tribe.color + ';';
          }

          if(style !== '') {
            attrs.$set('style', style);
          }
        }

      }
    };
  }
})();
