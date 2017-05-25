/**
 * Dummy helper for Angulartics for testing purposes
 *
 * Based on:
 * https://github.com/angulartics/angulartics/blob/master/src/angulartics-debug.js
 */
(function (angular) {
  'use strict';

  /**
   * @ngdoc overview
   * @name angulartics.null
   */
  angular.module('angulartics.null', ['angulartics'])
  .config(['$analyticsProvider', function ($analyticsProvider) {

    /* eslint-disable no-use-before-define */

    $analyticsProvider.registerPageTrack(function() {
      // Do nothing, don't even pollute console.log
    });

    $analyticsProvider.registerEventTrack(function() {
      // Do nothing, don't even pollute console.log
    });

    /* eslint-enable no-use-before-define */

  }]);

}(angular));
