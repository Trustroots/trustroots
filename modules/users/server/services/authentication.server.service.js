'use strict';

var path = require('path'),
    config = require(path.resolve('./config/config'));

exports.generateEmailToken = function (user, saltBuffer) {
  var email = user.emailTemporary || user.email;
  var buf = Buffer.concat([saltBuffer, Buffer.from(email)]);
  return buf.toString('hex');
};

/**
 * A Validation function for username
 *
 * Used at Mongoose Schema
 *
 * - at least 3 characters
 * - only a-z0-9_-.
 * - contain at least one alphanumeric character
 * - not in list of illegal usernames
 * - no consecutive dots: "." ok, ".." nope
 * - not begin or end with "."
 */
exports.validateUsername = function (username) {
  username = String(username).toLowerCase();
  var usernameRegex = /^(?=.*[0-9a-z])[0-9a-z.\-_]{3,34}$/,
      dotsRegex = /^[^.](?!.*(\.)\1).*[^.]$/;

  return username &&
    usernameRegex.test(username) &&
    dotsRegex.test(username) &&
    !exports.isUsernameReserved(username);
};

/**
 * Check if username is in the list of reserved usernames
 *
 * You can modify the list of reserved usernames from `config/env/default.js`
 *
 * @param {String} username - username to check for
 * @returns {Boolean} true if found from list, false if not
 */
exports.isUsernameReserved = function (username) {
  return config.illegalStrings.indexOf(username.toLowerCase()) !== -1;
};
