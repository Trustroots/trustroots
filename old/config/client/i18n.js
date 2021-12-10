import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-xhr-backend';
import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import moment from 'moment';

const isTest = process.env.NODE_ENV === 'test';

/**
 * The locales currently supported by the app are specified in /config/shared/locales.json
 * Add a language there if you want to support a new translation.
 * Read more at /config/shared/README.md
 */

/**
 * translations are specified in /public/locales/{language-code}/translation.json
 */

/**
 * Ensures RTL CSS stylesheet has been loaded into the page.
 *
 * @returns {Promise} Resolves once loaded
 */
export function loadRtlCSS() {
  return new Promise(resolve => {
    const id = 'rtl-style';

    // Check if RTL style has already been loaded
    if (document.getElementById(id)) {
      return resolve();
    }

    const link = document.createElement('link');
    link.href = `assets/main.rtl.css?c=${window?.settings?.commit ?? ''}`;
    link.id = id;
    link.rel = 'stylesheet';
    link.type = 'text/css';

    link.onload = () => {
      link.onload = null;
      resolve();
    };

    document.head.append(link);
  });
}

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

  if (typeof value === 'number' && format === 'number') {
    return value.toLocaleString(languageCode);
  }

  return value;
}

if (!isTest) {
  // load translation using xhr -> see /public/locales
  // learn more: https://github.com/i18next/i18next-xhr-backend
  i18n.use(Backend);
}

i18n
  // detect user language
  // learn more: https://github.com/i18next/i18next-browser-languageDetector
  .use(LanguageDetector)
  // pass the i18n instance to react-i18next.
  .use(initReactI18next)
  // init i18next
  // for all options read: https://www.i18next.com/overview/configuration-options
  .init({
    ...(isTest
      ? {
          resources: {
            en: {},
          },
        }
      : {}),
    fallbackLng: 'en', // a default app locale
    // allow keys to be phrases having `:`, `.`
    nsSeparator: false,
    keySeparator: false, // we do not use keys in form messages.welcome
    returnEmptyString: false,
    interpolation: {
      escapeValue: false, // react already safes from xss
      format,
    },
    detection: {
      lookupCookie: 'i18n',
      order: ['cookie'],
      caches: ['cookie'],
    },
    react: {
      useSuspense: false,
    },
    // debug: true, // show missing translation keys in console.log
  });

i18n.on('languageChanged', async languageCode => {
  const direction = i18n.dir(languageCode); // `rtl` (right-to-left), or `ltr` (left-to-right)

  document.documentElement.lang = languageCode;
  document.documentElement.dir = direction;

  if (direction === 'rtl') {
    await loadRtlCSS();
  }

  // Date+time library
  moment.locale(languageCode);
});

export default i18n;
