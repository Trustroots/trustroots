const config = require('../../../../config/config');
// Emoji sequences can combine pictographs, modifiers, joiners and selectors.
// eslint-disable-next-line no-misleading-character-class
const nameRegex = new RegExp(
  '^(?=.*\\p{L})[\\p{L}\\p{M} ._’\\-\\p{Extended_Pictographic}\\p{Emoji_Modifier}\\u200D\\uFE0F]*$',
  'u',
);
const usernameRegex = /^(?=.*[a-z])[a-z0-9]{3,34}$/;
const legacyUsernameLookupRegex = /^[A-Za-z0-9._-]{3,34}$/;

exports.usernameFormatErrorMessage =
  'Use 3-34 lowercase letters and numbers, including at least one letter.';
exports.usernameUnavailableMessage = 'Username is not available.';

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
 * Name fields shown on profiles and in administration tools.
 *
 * Keep this deliberately permissive for international names while excluding
 * digits and code-like punctuation. Names may contain letters, combining
 * marks, spaces, full stops, underscores, apostrophes, hyphens, and emoji. At
 * least one letter is still required, so emoji can decorate a name but cannot
 * replace it.
 */
exports.isNameFormatValid = function (name) {
  return (
    typeof name === 'string' &&
    name.length <= 34 &&
    !name.toLowerCase().includes('www') &&
    !name.toLowerCase().includes('bit.ly') &&
    nameRegex.test(name)
  );
};

/**
 * NIP-05 and other legacy username lookups.
 *
 * Uses the pre-policy character set (including `.`, `-`, `_`) and does not
 * require a letter, so existing users like `123` or `legacy.user` stay
 * addressable. New signups use `isUsernameFormatValid` instead — do not
 * merge these regexes.
 */
exports.isLegacyUsernameLookupValid = function (username) {
  return (
    typeof username === 'string' && legacyUsernameLookupRegex.test(username)
  );
};

/**
 * User-facing rejection message for signup and username changes, or null if ok.
 *
 * @param {String} username
 * @returns {String|null}
 */
exports.getUsernameRejectionMessage = function (username) {
  if (!exports.isUsernameFormatValid(username)) {
    return exports.usernameFormatErrorMessage;
  }

  if (exports.isUsernameReserved(username)) {
    return exports.usernameUnavailableMessage;
  }

  return null;
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
