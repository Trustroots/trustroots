const _ = require('lodash');
const path = require('path');
const moment = require('moment');
const config = require(path.resolve('./config/config'));

// These functions use an integer `inviteKey` and a date (ignoring time) to
// calculate invite codes. The invite code can then be turned back into a date
// with the same `inviteKey`. If `inviteKey` is ever changed, then the old codes
// will not work any more.

const setMidnight = function (date) {
  // It's crucial we set these by UTC because we use the timestamp at
  // midnight as an integer to create a code. If each timezone generated a
  // different timestamp for midnight, then each timezone would create a
  // different code which would only work in the same timezone.
  date.setUTCHours(0, 0, 0, 0); // Sets hours, minutes, seconds, ms
  return date;
};

/**
 * Set date object to tomorrow
 */
const setTomorrow = function (d) {
  const date = new Date(d.getTime());
  date.setDate(date.getDate() + 1);
  return date;
};

/**
 * Set date object to yesterday
 */
const setYesterday = function (d) {
  const date = new Date(d.getTime());
  date.setDate(date.getDate() - 1);
  return date;
};

/**
 * Push the date 2 days back so it's the day before yesterday
 */
const setYesterdayTwo = function (d) {
  const date = new Date(d.getTime());
  date.setDate(date.getDate() - 2);
  return date;
};

/**
 * Take a date object and return an integer
 */
const dayToInt = function (d) {
  return Math.floor(d.getTime() / 1e3);
};

/**
 * Take an integer and return a date object
 */
const intToDay = function (i) {
  return new Date(i * 1e3);
};

/**
 * Take an integer code and generate a string
 */
const intToCode = function (i) {
  return i.toString(36);
};

/**
 * Take a string code and generate an integer
 */
const codeToInt = function (s) {
  return parseInt(s, 36);
};

/**
 * Given an invite key (integer) and a code (string) generate a date.
 *
 * `config.invitations.key` - should always be the same, an integer.
 *
 * @param {String} code - a string representation of the invitation code
 * @return {Date} a date object (without time)
 */
const codeToDate = function (code) {
  return intToDay(parseInt(config.invitations.key, 10) ^ codeToInt(code));
};

/**
 * Given an invite key (integer) and a date object, calculate a code
 *
 * `config.invitations.key` - should always be the same, an integer
 *
 * @return {String} a string version of the invite code
 */
exports.getCode = function () {

  const dateInt = dayToInt(setMidnight(new Date()));

  // Should always be the same, an integer
  const inviteKey = parseInt(config.invitations.key, 10);

  return intToCode(inviteKey ^ dateInt);
};

/**
 * Validate against "always valid codes" list
 *
 * @param {String} code - a lower case string representation of the invitation code
 * @return {Boolean} `true` if code is in predefined list, `false` if not
 */
exports.isPredefined = function (code) {
  if (code && _.indexOf(config.invitations.alwaysValidCodes, code) > -1) {
    return true;
  }

  return false;
};

/**
 * Checks if a code is valid and returns boolean yes or no.
 *
 * @param {String} code - a lower case string representation of the invitation code
 * @return {Boolean} `true` if code is valid, `false` if not
 */
exports.validateCode = function (code) {

  // No empty strings
  if (!code) {
    return false;
  }

  // Validate against "always valid codes" list
  if (exports.isPredefined(code)) {
    return true;
  }

  const now = moment(new Date());
  const codeDate = codeToDate(code);

  return now.isSame(codeDate, 'day') ||
    now.isSame(setYesterday(codeDate), 'day') ||
    now.isSame(setTomorrow(codeDate), 'day') ||
    now.isSame(setYesterdayTwo(codeDate), 'day');
};
