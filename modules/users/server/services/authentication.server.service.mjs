import config from '../../../../config/config.js';

const service = {};

service.generateEmailToken = function (user, saltBuffer) {
  const email = user.emailTemporary || user.email;
  const buf = Buffer.concat([saltBuffer, Buffer.from(email)]);
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
service.validateUsername = function (username) {
  username = String(username).toLowerCase();
  const usernameRegex = /^(?=.*[0-9a-z])[0-9a-z.\-_]{3,34}$/;
  const dotsRegex = /^[^.](?!.*(\.)\1).*[^.]$/;

  return (
    username &&
    usernameRegex.test(username) &&
    dotsRegex.test(username) &&
    !service.isUsernameReserved(username)
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
service.isUsernameReserved = function (username) {
  return config.illegalStrings.indexOf(username.toLowerCase()) !== -1;
};

const defaultExport = service;
export default defaultExport;
export const generateEmailToken = defaultExport.generateEmailToken;
export const isUsernameReserved = defaultExport.isUsernameReserved;
export const validateUsername = defaultExport.validateUsername;
