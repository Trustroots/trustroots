import { getGender } from '@/modules/core/client/utils/user_info';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: key => `users:${key}`,
  }),
}));

describe('user info utilities', function () {
  it('returns translated labels for known gender codes', function () {
    expect(getGender('female')).toBe('users:Female');
    expect(getGender('male')).toBe('users:Male');
    expect(getGender('non-binary')).toBe('users:Non-binary');
    expect(getGender('other')).toBe('users:Other gender');
  });

  it('returns undefined for unknown gender code', function () {
    expect(getGender('fluid')).toBeUndefined();
  });

  it('returns undefined for empty input', function () {
    expect(getGender('')).toBeUndefined();
    expect(getGender(undefined)).toBeUndefined();
  });
});
