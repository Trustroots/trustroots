import config from './../../../../config/config.mjs';
const service = {};
service.generateEmailToken = function (user, saltBuffer) {
  const email = user.emailTemporary || user.email;
  const buf = Buffer.concat([saltBuffer, Buffer.from(email)]);
  return buf.toString('hex');
};

/** Selection policy for new accounts and changed usernames; never use for lookups. */
service.usernameFormatMessage =
  'Use 3–34 letters and numbers, including at least one letter.';
service.isUsernameFormatValid = function (username) {
  return (
    typeof username === 'string' &&
    /^(?=.*[A-Za-z])[A-Za-z0-9]{3,34}$/.test(username)
  );
};
service.validateUsername = function (username) {
  return (
    service.isUsernameFormatValid(username) &&
    !service.isUsernameReserved(username)
  );
};

/** Preserve the pre-policy lookup alphabet, including digits-only and reserved identities. */
service.isLegacyUsernameLookupValid = function (username) {
  return (
    typeof username === 'string' &&
    /^(?=.*[0-9A-Za-z])[0-9A-Za-z._-]{3,34}$/.test(username)
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
export const isUsernameFormatValid = defaultExport.isUsernameFormatValid;
export const isLegacyUsernameLookupValid =
  defaultExport.isLegacyUsernameLookupValid;
export const usernameFormatMessage = defaultExport.usernameFormatMessage;
export { defaultExport as 'module.exports' };
