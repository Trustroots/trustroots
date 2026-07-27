const config = require('../../../../config/config');
const crypto = require('crypto');

// Keep failed local-password checks comparable in cost even when no member was
// found. The value is deliberately fixed: it is only used to consume the same
// PBKDF2 work as User#authenticate, never to authenticate a member.
const passwordTimingSalt = Buffer.from(
  'dHJ1c3Ryb290cy1wYXNzd29yZC10aW1pbmc=',
  'base64',
);

exports.generateEmailToken = function (user, saltBuffer) {
  const email = user.emailTemporary || user.email;
  const buf = Buffer.concat([saltBuffer, Buffer.from(email)]);
  return buf.toString('hex');
};

exports.consumePasswordDerivation = function (password) {
  crypto.pbkdf2Sync(password, passwordTimingSalt, 10000, 64, 'SHA1');
};

exports.isActiveMember = function (user) {
  return user && !user.roles.includes('suspended');
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
  const usernameRegex = /^(?=.*[0-9a-z])[0-9a-z.\-_]{3,34}$/;
  const dotsRegex = /^[^.](?!.*(\.)\1).*[^.]$/;

  return (
    username &&
    usernameRegex.test(username) &&
    dotsRegex.test(username) &&
    !exports.isUsernameReserved(username)
  );
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
