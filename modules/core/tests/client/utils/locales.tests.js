import locales from '@/config/shared/locales.json';
import {
  getLocales,
  getSearchedLocales,
} from '@/modules/core/client/utils/locales';

describe('locales utils', () => {
  it('returns all locales in non-production mode', () => {
    const currentEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    const allLocales = getLocales();
    expect(allLocales).toBe(locales);

    process.env.NODE_ENV = currentEnv;
  });

  it('returns sorted production locales when in production mode', () => {
    const currentEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const productionLocales = getLocales();
    const expected = locales.filter(({ production }) => production);
    const sortedExpected = [...expected].sort((a, b) =>
      a.label.localeCompare(b.label),
    );

    expect(productionLocales).toEqual(sortedExpected);

    process.env.NODE_ENV = currentEnv;
  });

  it('searches locales by label, code, or English name without accents', () => {
    const searchData = [
      { label: 'Café', code: 'fr', english: 'French' },
      { label: 'English', code: 'en', english: 'English' },
      { label: 'Español', code: 'es', english: 'Spanish' },
    ];

    expect(getSearchedLocales(searchData, 'cafe')).toEqual([
      { label: 'Café', code: 'fr', english: 'French' },
    ]);
    expect(getSearchedLocales(searchData, 'ES')).toEqual([
      { label: 'Español', code: 'es', english: 'Spanish' },
    ]);
    expect(getSearchedLocales(searchData, 'spani')).toEqual([
      { label: 'Español', code: 'es', english: 'Spanish' },
    ]);
  });

  it('treats missing search text and missing locale fields as empty strings', () => {
    const searchData = [
      { label: 'English', code: 'en', english: 'English' },
      { label: undefined, code: undefined, english: undefined },
    ];

    expect(getSearchedLocales(searchData)).toEqual(searchData);
    expect(getSearchedLocales(searchData, 'english')).toEqual([searchData[0]]);
  });
});
