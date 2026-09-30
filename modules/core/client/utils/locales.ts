import sortBy from 'lodash/sortBy';
import locales from '@/config/shared/locales.json';

export type Locale = {
  label: string;
  code: string;
  english: string;
  production: boolean;
};

const localeList = locales as Locale[];

const deburr = (value: string): string =>
  value?.normalize('NFD').replace(/[\u0300-\u036f]/g, '') ?? '';

const getSearchableFields = ({ label, code, english }: Locale): string[] =>
  [label, code, english].map(deburr).map(name => name.toLowerCase());

export function getLocales(): Locale[] {
  if (process.env.NODE_ENV === 'production') {
    const filteredLocales = localeList.filter(({ production }) => production);
    return sortBy(filteredLocales, 'label');
  }

  return localeList;
}

export function getSearchedLocales(
  availableLocales: readonly Locale[],
  search: string,
): Locale[] {
  const searchString = deburr(search).toLowerCase();
  return availableLocales.filter(language =>
    getSearchableFields(language).some(name => name.includes(searchString)),
  );
}
