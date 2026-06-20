import { createValidator } from '@/modules/core/client/utils/validation';

describe('createValidator', () => {
  it('returns no errors for values without matching rules', () => {
    const validate = createValidator({});

    expect(validate({ username: 'alice' })).toEqual({
      username: [],
    });
  });

  it('collects errors from failing rules only', () => {
    const validate = createValidator({
      username: [
        [value => value.length >= 3, 'too-short'],
        [value => /^[a-z]+$/.test(value), 'invalid-characters'],
      ],
    });

    expect(validate({ username: 'a1' })).toEqual({
      username: ['too-short', 'invalid-characters'],
    });
  });

  it('passes the whole values object to validation rules', () => {
    const validate = createValidator({
      confirmPassword: [
        [(value, values) => value === values.password, 'password-mismatch'],
      ],
    });

    expect(
      validate({ password: 'secret', confirmPassword: 'different' }),
    ).toEqual({
      password: [],
      confirmPassword: ['password-mismatch'],
    });
  });
});
