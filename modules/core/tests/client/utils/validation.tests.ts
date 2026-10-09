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
        [
          (value: unknown) => typeof value === 'string' && value.length >= 3,
          'too-short',
        ],
        [
          (value: unknown) =>
            typeof value === 'string' && /^[a-z]+$/.test(value),
          'invalid-characters',
        ],
      ],
    });

    expect(validate({ username: 'a1' })).toEqual({
      username: ['too-short', 'invalid-characters'],
    });
  });

  it('passes the whole values object to validation rules', () => {
    const validate = createValidator({
      confirmPassword: [
        [
          (
            value: unknown,
            values: { password: string; confirmPassword: string },
          ) => value === values.password,
          'password-mismatch',
        ],
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
