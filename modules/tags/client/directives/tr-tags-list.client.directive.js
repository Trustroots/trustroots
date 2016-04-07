(function() {
  'use strict';

  /**
   * Simple list of tribes
   */
  angular
    .module('tags')
    .directive('trTagsList', trTagsListDirective);

  /* @ngInject */
  function trTagsListDirective() {
    return {
      templateUrl: '/modules/tags/views/directives/tr-tags-list.client.view.html',
      restrict: 'A',
      replace: true,
      scope: {
        tags: '=trTagsList'
      }
    };

  }
})();
