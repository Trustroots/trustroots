(function() {
  'use strict';

  /**
   * Simple list of tribes
   */
  angular
    .module('tags')
    .directive('trTribesList', trTribesListDirective);

  /* @ngInject */
  function trTribesListDirective() {
    return {
      templateUrl: '/modules/tags/views/directives/tr-tribes-list.client.view.html',
      restrict: 'A',
      replace: true,
      scope: {
        tribes: '=trTribesList',
        isOwnProfile: '=isOwnProfile'
      }
    };

  }
})();
