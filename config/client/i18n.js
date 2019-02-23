import i18n from 'i18next';
import { reactI18nextModule } from 'react-i18next';
import backend from 'i18next-xhr-backend';
import moment from 'moment';
import { defaultLanguageCode } from './i18n-languages';

// translations are already at
// '../public/locales/**/translation.json'
// which is the default for the xhr backend to load from

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
  .use(backend)
  .use(reactI18nextModule) // passes i18n down to react-i18next
  .init({
    lng: defaultLanguageCode,
    // allow keys to be phrases having `:`, `.`
    nsSeparator: false,
    // saveMissing: true, // @TODO send not translated keys to endpoint
    keySeparator: false, // we do not use keys in form messages.welcome
    interpolation: {
      escapeValue: false, // react already safes from xss
      format
    }
    // saveMissingPlurals: true,
    // debug: true // show missing translation keys in console.log
  });

export default i18n;
