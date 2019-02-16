import i18n from 'i18next';
import { reactI18nextModule } from 'react-i18next';
import backend from 'i18next-xhr-backend';
import detector from 'i18next-browser-languagedetector';
import moment from 'moment';

/**
 * The locales currently supported by the app are specified in /config/shared/locales.json
 * Add a language there if you want to support a new translation.
 * Read more at /config/shared/README.md
 *
 * @TODO For a nice user experience we may want to sort the languages by their actual usage,
 * or alphabetically,
 * or allow searching for them.
 * This will be relevant when we have a lot of translations done or in progress. Not now.
 */

/**
 * translations are specified in /public/locales/{language-code}/translation.json
 */

/**
 * Format a translation parameter
 *
 * @param {Date|any} value - value to format
 * @param {string} format - a code that defines what to do with the string
 *    allowed values for Date:
 *      - fromNow - how long time has passed since the Date
 *      - age - amount of finished years since the Date
 *      - {format} - i.e. YYYYMMdd - format string to apply on the Date object
 * @param {string} languageCode - the ietf language code (learn more @/config/client/i18n-languages)
 * @returns {string|any} - the formatted value
 *                         or the original value, if the value type or format not recognized)
 */
function format(value, format, languageCode) {

  if (value instanceof Date) {
    moment.locale(languageCode);
    if (format === 'fromNow') return moment(value).fromNow();
    if (format === 'age') return moment().diff(moment(value), 'years');
    return moment(value).format(format);
  }

  return value;
}

i18n
  .use(detector)
  .use(backend)
  .use(reactI18nextModule) // passes i18n down to react-i18next
  .init({
    // allow keys to be phrases having `:`, `.`
    fallbackLng: 'en', // a default app locale
    nsSeparator: false,
    keySeparator: false, // we do not use keys in form messages.welcome
    // saveMissing: true, // @TODO send not translated keys to endpoint
    interpolation: {
      escapeValue: false, // react already safes from xss
      format
    },
    detection: {
      lookupCookie: 'i18n',
      order: ['cookie'],
      caches: ['cookie']
    }
    // saveMissingPlurals: true,
    // debug: true // show missing translation keys in console.log
  });

export default i18n;
