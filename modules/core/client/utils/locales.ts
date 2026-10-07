import sortBy from 'lodash/sortBy';
import locales from '@/config/shared/locales.json';

export type Locale = {
  label: string;
  code: string;
  english: string;
  production: boolean;
};

const localeList = locales as Locale[];

export const deburr = (value: string): string =>
  value?.normalize('NFD').replace(/[\u0300-\u036f]/g, '') ?? '';

export const normaliseForSearch = (value: string): string =>
  deburr(value).toLowerCase();

const getSearchableFields = ({ label, code, english }: Locale): string[] =>
  [label, code, english].map(normaliseForSearch);

export function getLocales(): Locale[] {
  if (process.env.NODE_ENV === 'production') {
    const filteredLocales = localeList.filter(({ production }) => production);
    return sortBy(filteredLocales, 'label');
  }

  return localeList;
}

export function getSearchedLocales(
  availableLocales: readonly Locale[],
  search = '',
): Locale[] {
  const searchString = normaliseForSearch(search);
  return availableLocales.filter(language =>
    getSearchableFields(language).some(name => name.includes(searchString)),
  );
}
