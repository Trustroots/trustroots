import {
  getEmailFromToken,
  getSafeReturnTo,
  getUsernameValidationError,
  redirectAfterSignin,
} from '@/modules/users/client/utils/auth';

const mockedNavigate = jest.fn();

describe('auth utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('extracts email from long confirm tokens', () => {
    const token = `${'a'.repeat(40)}616461406578616d706c652e636f6d`;

    expect(getEmailFromToken(token)).toBe('ada@example.com');
  });

  it('returns null for legacy short tokens', () => {
    expect(getEmailFromToken('a'.repeat(40))).toBeNull();
    expect(getEmailFromToken(`${'a'.repeat(40)}6`)).toBeNull();
    expect(getEmailFromToken(`${'a'.repeat(40)}zz`)).toBeNull();
    expect(getEmailFromToken()).toBeNull();
  });

  it('rejects non-string confirmation tokens', () => {
    expect(getEmailFromToken(123 as unknown as string)).toBeNull();
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

  it('reloads the requested local destination through the router after continuing signin', () => {
    redirectAfterSignin(
      mockedNavigate,
      true,
      '/messages/alice?tab=unread#latest',
    );
    expect(mockedNavigate).toHaveBeenCalledWith({
      href: '/messages/alice?tab=unread#latest',
      reloadDocument: true,
    });
  });

  it('keeps local paths, query and hash in the safe return destination', () => {
    expect(getSafeReturnTo('/')).toBe('/');
    expect(getSafeReturnTo('/messages/alice?tab=unread#latest')).toBe(
      '/messages/alice?tab=unread#latest',
    );
    expect(getSafeReturnTo('/a/../messages')).toBe('/messages');
  });

  it('rejects external destinations after signin', () => {
    expect(getSafeReturnTo('https://example.com')).toBeNull();
    expect(getSafeReturnTo('//example.com')).toBeNull();
    expect(getSafeReturnTo('/\t/example.com')).toBeNull();
    expect(getSafeReturnTo('/\\example.com')).toBeNull();
    expect(getSafeReturnTo('messages/alice')).toBeNull();
    expect(getSafeReturnTo(123 as unknown as string)).toBeNull();

    redirectAfterSignin(mockedNavigate, true, '//example.com');
    expect(mockedNavigate).toHaveBeenCalledWith({
      href: '/search',
      reloadDocument: true,
    });
  });

  it('rejects absolute same-origin destinations after signin', () => {
    const sameOrigin = `${window.location.origin}/messages`;

    expect(getSafeReturnTo(sameOrigin)).toBeNull();

    redirectAfterSignin(mockedNavigate, true, sameOrigin);
    expect(mockedNavigate).toHaveBeenCalledWith({
      href: '/search',
      reloadDocument: true,
    });
  });

  it('redirects to search when there is no continuation destination', () => {
    redirectAfterSignin(mockedNavigate, true, undefined);
    expect(mockedNavigate).toHaveBeenCalledWith({
      href: '/search',
      reloadDocument: true,
    });
  });

  it('redirects to search when sign-in should not continue', () => {
    redirectAfterSignin(mockedNavigate, false, '/messages/alice');
    expect(mockedNavigate).toHaveBeenCalledWith({
      href: '/search',
      reloadDocument: true,
    });
  });
});
