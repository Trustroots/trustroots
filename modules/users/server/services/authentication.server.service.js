const config = require('../../../../config/config');
const usernameRegex = /^(?=.*[a-z])[a-z0-9]{3,34}$/;

exports.generateEmailToken = function (user, saltBuffer) {
  const email = user.emailTemporary || user.email;
  const buf = Buffer.concat([saltBuffer, Buffer.from(email)]);
  return buf.toString('hex');
};

/**
 * A Validation function for username
 *
 * Used for signup and username changes.
 *
 * - at least 3 characters
 * - at most 34 characters
 * - only a-z0-9
 * - contain at least one letter
 * - not in list of illegal usernames
 */
exports.validateUsername = function (username) {
  username = String(username);

  return Boolean(
    username &&
      exports.isUsernameFormatValid(username) &&
      !exports.isUsernameReserved(username),
  );
};

exports.isUsernameFormatValid = function (username) {
  return usernameRegex.test(String(username));
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
