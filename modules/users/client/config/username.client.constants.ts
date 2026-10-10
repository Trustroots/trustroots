// New selections use letters and digits; existing identities can stay.
export const SIGNUP_USERNAME_REGEX = /^(?=.*[A-Za-z])[A-Za-z0-9]{3,34}$/;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 34;
export const SIGNUP_USERNAME_FORMAT_MESSAGE =
  'Use 3–34 letters and numbers, including at least one letter.';
