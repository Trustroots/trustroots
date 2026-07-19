import {
  applyAuthenticatedUser,
  getEmailFromToken,
  getUsernameValidationError,
  redirectAfterSignin,
} from '@/modules/users/client/utils/auth';
import {
  broadcastClientEvent,
  navigate,
} from '@/modules/core/client/services/client-runtime';

jest.mock('@/modules/core/client/services/client-runtime', () => ({
  broadcastClientEvent: jest.fn(),
  navigate: jest.fn(),
}));

describe('auth utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete window.user;
  });

  it('extracts email from long confirm tokens', () => {
    const token = `${'a'.repeat(40)}616461406578616d706c652e636f6d`;

    expect(getEmailFromToken(token)).toBe('ada@example.com');
  });

  it('returns null for legacy short tokens', () => {
    expect(getEmailFromToken('a'.repeat(40))).toBeNull();
    expect(getEmailFromToken()).toBeNull();
  });

  it('returns username validation messages', () => {
    expect(
      getUsernameValidationError({
        errors: { required: true },
        isDirty: true,
        isValid: false,
        value: '',
      }),
    ).toBe('Username is required.');

    expect(
      getUsernameValidationError({
        errors: { maxlength: true },
        isDirty: true,
        isValid: false,
        usernameMaxlength: 20,
        value: 'a'.repeat(21),
      }),
    ).toBe('Too long, maximum length is 20 characters.');

    expect(
      getUsernameValidationError({
        errors: { minlength: true },
        isDirty: true,
        isValid: false,
        usernameMinlength: 4,
        value: 'abc',
      }),
    ).toBe('Too short, minimum length is 4 characters.');

    expect(
      getUsernameValidationError({
        errors: { pattern: true },
        isDirty: true,
        isValid: false,
        value: '!!!',
      }),
    ).toBe('Invalid username.');

    expect(
      getUsernameValidationError({
        errors: { username: true },
        isDirty: true,
        isValid: false,
        value: 'taken',
      }),
    ).toBe('This username is already in use.');
  });

  it('returns an empty validation message for untouched valid fields', () => {
    expect(getUsernameValidationError({})).toBe('');
    expect(getUsernameValidationError({ value: 'ada' })).toBe('');
    expect(
      getUsernameValidationError({
        errors: { required: false },
        isDirty: true,
        isValid: false,
        value: '',
      }),
    ).toBe('Username is required.');
  });

  it('returns a generic validation message for an unknown error', () => {
    expect(
      getUsernameValidationError({
        errors: {},
        isDirty: true,
        isValid: false,
        value: 'bad value',
      }),
    ).toBe('Invalid username.');
  });

  it('uses default validation limits and value', () => {
    expect(
      getUsernameValidationError({
        errors: { minlength: true },
        isDirty: true,
        isValid: false,
        value: 'ab',
      }),
    ).toBe('Too short, minimum length is 3 characters.');
    expect(
      getUsernameValidationError({
        errors: { maxlength: true },
        isDirty: true,
        isValid: false,
        value: 'a'.repeat(35),
      }),
    ).toBe('Too long, maximum length is 34 characters.');
  });

  it('updates React and window user state after authentication', () => {
    const setUser = jest.fn();
    const user = { _id: 'user-1', username: 'ada' };

    applyAuthenticatedUser(user, setUser);

    expect(setUser).toHaveBeenCalledWith(user);
    expect(window.user).toBe(user);
    expect(broadcastClientEvent).toHaveBeenCalledWith('userUpdated');
  });

  it('redirects to search after signin', () => {
    redirectAfterSignin(true);
    expect(navigate).toHaveBeenCalledWith('search.map');
  });
});
