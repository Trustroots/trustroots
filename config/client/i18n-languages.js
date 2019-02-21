/**
 * These are the languages that the application's i18n (internationalization) supports.
 * Find the allowed language names, codes and pluralization suffixes at
 * https://jsfiddle.net/jamuhl/3sL01fn0/#tabs=result
 * Look for language codes in iana.org registry
 * https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry
 *
 * @property {string} code - language code used by i18next, momentjs, i.e. /public/locales/{code}/translation.json
 * @property {string} label - language name, preferably in the native language
 */

/**
 * @TODO For a nice user experience we may want to sort the languages by their actual usage,
 * or alphabetically (is it even possible?),
 * or allow searching for them.
 * This will be relevant when we have a lot of translations done or in progress. Not now.
 */
import locales from '@/config/shared/locales';

const availableLanguages = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'español' },
  { code: 'fr', label: 'français' },
  { code: 'ar', label: 'العربية' },
  { code: 'ru', label: 'русский язык' },
  { code: 'zh', label: '中文' },
  { code: 'cs', label: 'česky' },
  { code: 'fi', label: 'suomi' },
  { code: 'de', label: 'Deutsch' }
];

/**
 * export default only languages currently supported by API
 */
export default availableLanguages.filter(({ code }) => locales.includes(code));

/**
 * The default language code
 */
export const defaultLanguageCode = 'en';
