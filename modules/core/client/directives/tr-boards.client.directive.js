(function(){
  'use strict';

  /**
   * Directive that gives random class from provided class array.
   * Typically you would rotate board-* classes found from /modules/core/client/less/board.less
   *
   * Usage:
   *
   * <div tr-boards="classes">
   *
   * When:
   * vm.classes = ['board-sierranevada', 'board-hitchroad'];
   */
  angular
    .module('core')
    .directive('trBoards', trBoardsDirective);

  /* @ngInject */
  function trBoardsDirective($http) {
    return {
      restrict: 'A',
      replace: false,
      scope: {
          trBoards: '='
      },
      link: function (scope, elem, attr) {

          // Add random background class to the element
          elem.addClass(scope.trBoards[Math.floor(Math.random() * (scope.trBoards.length))]);
      }
    };
  }

})();
