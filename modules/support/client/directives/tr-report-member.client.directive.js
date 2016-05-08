(function() {
  'use strict';

  /**
   * @ngdoc directive
   *
   * @name trustroots:trReportMember
   *
   * Report members via support module.
   *
   * Usage:
   * `<span tr-report-member="model.username"></span>`
   *
   */
  angular
    .module('users')
    .directive('trReportMember', trReportMemberDirective);

  /* @ngInject */
  function trReportMemberDirective() {
    return {
      restrict: 'A',
      replace: true,
      template: '<small><a ui-sref="support({report: username})" class="text-muted">Report member</a></small>',
      scope: {
        username: '=trReportMember'
      }
    };
  }

})();
