import fs from 'fs';
import path from 'path';
import i18n from '@/config/client/i18n';

const localesRoot = path.join(__dirname, '../../../../public/locales');
const categorySuffix = /_(zero|one|two|few|many|other)$/;

function readLocale(locale: string, namespace: string): Record<string, string> {
  return JSON.parse(
    fs.readFileSync(
      path.join(localesRoot, locale, `${namespace}.json`),
      'utf8',
    ),
  );
}

describe('locale plural keys', () => {
  const locales = fs.readdirSync(localesRoot);

  it.each(locales)(
    '%s uses only CLDR plural suffixes valid for the language',
    locale => {
      const lng = locale.replace(/_/g, '-');
      const allowed = new Set(
        i18n.services.pluralResolver
          .getSuffixes(lng)
          .map((suffix: string) => suffix.replace(/^_/, '')),
      );
      const problems: string[] = [];

      for (const file of fs.readdirSync(path.join(localesRoot, locale))) {
        const namespace = file.replace(/\.json$/, '');
        for (const [key, value] of Object.entries(
          readLocale(locale, namespace),
        )) {
          if (/_plural$|_\d$/.test(key)) {
            problems.push(`${namespace}: legacy plural key "${key}"`);
          }
          const match = key.match(categorySuffix);
          if (match && value !== '' && !allowed.has(match[1])) {
            problems.push(`${namespace}: "${key}" is not a ${lng} plural form`);
          }
        }
      }

      expect(problems).toEqual([]);
    },
  );

  it('picks the plural form for the count in Polish and English', () => {
    i18n.addResourceBundle(
      'pl',
      'users',
      readLocale('pl', 'users'),
      true,
      true,
    );
    i18n.addResourceBundle(
      'en',
      'users',
      readLocale('en', 'users'),
      true,
      true,
    );
    const key = '{{count}} contacts';

    expect(i18n.t(key, { lng: 'pl', ns: 'users', count: 1 })).toBe('1 kontakt');
    expect(i18n.t(key, { lng: 'pl', ns: 'users', count: 3 })).toBe(
      '3 kontakty',
    );
    expect(i18n.t(key, { lng: 'pl', ns: 'users', count: 5 })).toBe(
      '5 kontaktów',
    );
    expect(i18n.t(key, { lng: 'en', ns: 'users', count: 1 })).toBe('1 contact');
    expect(i18n.t(key, { lng: 'en', ns: 'users', count: 4 })).toBe(
      '4 contacts',
    );
  });
});
