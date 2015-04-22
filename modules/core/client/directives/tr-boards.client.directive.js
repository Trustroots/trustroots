'use strict';

/*
 * Directive that gives random class from provided class array.
 * Typically you would rotate board-* classes found from /public/modules/core/less/board.less
 *
 * Usage:
 *
 * <div tr-boards="classes">
 *
 * $scope.classes = ['board-sierranevada', 'board-hitchroad'];
 */
angular.module('core').directive('trBoards', [
  function($http) {
    return {
      restrict: 'A',
      replace: false,
      scope: {
          trBoards: '='
      },
      link: function (scope, elem, attr) {

          //Add random background class to selected element
          elem.addClass(scope.trBoards[Math.floor(Math.random() * (scope.trBoards.length))]);
      }
    };
  }
]);
