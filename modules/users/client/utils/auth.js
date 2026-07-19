import {
  broadcastClientEvent,
  navigate,
} from '@/modules/core/client/services/client-runtime';

export function getEmailFromToken(token = '') {
  if (token.length <= 40) {
    return null;
  }

  let email = '';

  for (let index = 40; index < token.length; index += 2) {
    email += String.fromCharCode(parseInt(token.substr(index, 2), 16));
  }

  return email;
}

export function getUsernameValidationError({
  value = '',
  isDirty = false,
  isValid = true,
  errors = {},
  usernameMinlength = 3,
  usernameMaxlength = 34,
}) {
  if (!isDirty || isValid) {
    return '';
  }

  if (errors.required || value === '') {
    return 'Username is required.';
  }

  if (errors.maxlength) {
    return `Too long, maximum length is ${usernameMaxlength} characters.`;
  }

  if (errors.minlength) {
    return `Too short, minimum length is ${usernameMinlength} characters.`;
  }

  if (errors.pattern) {
    return 'Invalid username.';
  }

  if (errors.username) {
    return 'This username is already in use.';
  }

  return 'Invalid username.';
}

export function applyAuthenticatedUser(user, setUser) {
  setUser(user);
  window.user = user;
  broadcastClientEvent('userUpdated');
}

export function redirectAfterSignin() {
  navigate('search.map');
}
