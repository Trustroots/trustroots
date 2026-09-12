// Signup already rejects underscores; profile username changes still allow them.
export const USERNAME_REGEX = /^(?=.*[0-9A-Za-z])[0-9A-Za-z.\-_]{3,34}$/;
export const SIGNUP_USERNAME_REGEX = /^(?=.*[0-9A-Za-z])[0-9A-Za-z.-]{3,34}$/;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 34;
export const USERNAME_FORMAT_MESSAGE =
  'Use 3-34 letters, numbers, periods, hyphens or underscores.';
export const SIGNUP_USERNAME_FORMAT_MESSAGE =
  'Use 3-34 letters, numbers, periods or hyphens. Underscores are not allowed at signup.';
