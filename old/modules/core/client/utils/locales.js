import sortBy from 'lodash/sortBy';
import locales from '@/config/shared/locales.json';

const deburr = string =>
  string?.normalize('NFD').replace(/[\u0300-\u036f]/g, '') ?? '';

const getSearchableFields = ({ label, code, english }) =>
  [label, code, english].map(deburr).map(name => name.toLowerCase());

export function getLocales() {
  // In production, list only languages over certain % translated
  if (process.env.NODE_ENV === 'production') {
    // Include only languages with `production:true` and sort them by label
    const filteredLocales = locales.filter(({ production }) => production);
    return sortBy(filteredLocales, 'label');
  }

  // For development, list all languages
  return locales;
}

export function getSearchedLocales(locales, search) {
  const searchString = deburr(search).toLowerCase();
  return locales.filter(language =>
    getSearchableFields(language).some(name => name.includes(searchString)),
  );
}
