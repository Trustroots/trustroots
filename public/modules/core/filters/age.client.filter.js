'use strict';

/**
 * Turn mongo date string into years
 *
 * Input: 1986-05-30T21:00:00.000Z
 * Output: 28 years
 *
 * @link http://stackoverflow.com/a/24883386
 * @link http://stackoverflow.com/a/21984136
 */
angular.module('core').filter('ageyears', ['$filter',
  function($filter) {
    return function(dateString) {

      var dateObj = new Date( $filter('date')(dateString, 'yyyy-MM-dd') ),
          ageDifMs = Date.now() - dateObj.getTime(),
          ageDate = new Date(ageDifMs); // miliseconds from epoch

      return Math.abs(ageDate.getUTCFullYear() - 1970) + ' years';

    };
  }
]);
