import { validLanguageLevels } from '@/modules/users/shared/language-levels';
it.each([
  null,
  undefined,
  [],
  'basic',
  1,
  { eng: null },
  { eng: 1 },
  { eng: 'fluent' },
  { eng: 'toString' },
  { fra: 'native' },
])('rejects invalid levels: %p', levels => {
  expect(validLanguageLevels(levels, ['eng'])).toBe(false);
});
it('accepts unspecified levels and all four levels', () => {
  expect(validLanguageLevels({}, [])).toBe(true);
  for (const level of ['basic', 'intermediate', 'advanced', 'native'])
    expect(validLanguageLevels({ eng: level }, ['eng'])).toBe(true);
});
