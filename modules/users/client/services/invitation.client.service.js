(function () {
  'use strict';

  angular
    .module('users')
    .factory('InvitationService', InvitationService);

  /* @ngInject */
  function InvitationService(moment) {

    // These functions use an integer `inviteKey` and a date (ignoring time) to
    // calculate invite codes. The invite code can then be turned back into a date
    // with the same `inviteKey`. If `inviteKey` is ever changed, then the old codes
    // will not work any more.

    var setMidnight = function(date) {
      date.setUTCHours(0);
      date.setUTCMinutes(0);
      date.setSeconds(0);
      date.setMilliseconds(0);
      return date;
    };

    var setYesterday = function(date) {
      date.setDate(date.getDate() - 1);
      return date;
    };

    // Take a date object and return an integer
    var dayToInt = function(d) {
      return d.getTime() / 1e3;
    };

    // Take an integer and return a date object
    var intToDay = function(i) {
      return new Date(i * 1e3);
    };

    // Take an integer code and generate a string
    var intToCode = function(i) {
      return i.toString(36);
    };

    // Take a string code and generate an integer
    var codeToInt = function(s) {
      return parseInt(s, 36);
    };

    // Given an invite key (integer) and a date object, calculate a code
    // `inviteKey` - should always be the same, an integer
    // `date` - can be like `new Date()` the times are ignored
    // Returns a string version of the invite code
    var dateToCode = function(inviteKey, date) {
      return intToCode(inviteKey ^ dayToInt(setMidnight(date)));
    };

    // Given an invite key (integer) and a code (string) generate a date
    // `inviteKey` - should always be the same, an integer
    // `code` - a string representation of the invitation code
    // Returns a date object (without time)
    var codeToDate = function(inviteKey, code) {
      return intToDay(inviteKey ^ codeToInt(code));
    };

    // Checks if a code is valid and returns boolean yes or no
    // `inviteKey` - should always be the same, an integer
    // `today` - a date object, can be `new Date()`, time is ignored
    // `code` - a string representation of the invitation code
    // Returns boolean true if code is valid, false if not
    var validateCode = function(inviteKey, today, code) {
      var date = codeToDate(code);
      return moment(today).isSame(date, 'day') ||
        moment(setYesterday(today)).isSame(date, 'day');
    };

    // Return service
    return {
      dateToCode: dateToCode,
      validateCode: validateCode
    };
  }

}());
