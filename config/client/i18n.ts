import { differenceInYears, format as formatDate } from 'date-fns';
import { initReactI18next } from 'react-i18next';
import i18n, { type FormatFunction } from 'i18next';
import { match } from 'ts-pattern';
import { timeAgo } from '@trustroots/relative-time';
import { languageCookie, localeBackend } from './i18n-resources';

const isTest = process.env.NODE_ENV === 'test';

/**
 * The locales currently supported by the app are specified in /packages/locales/locales.json
 * Add a language there if you want to support a new translation.
 * Read more at /packages/locales/README.md
 */

/**
 * translations are specified in /public/locales/{language-code}/translation.json
 */

/**
 * Ensures RTL CSS stylesheet has been loaded into the page.
 *
 * @returns {Promise} Resolves once loaded
 */
export function loadRtlCSS(): Promise<void> {
  return new Promise(resolve => {
    const id = 'rtl-style';

    // Check if RTL style has already been loaded
    if (document.getElementById(id)) {
      return resolve();
    }

    const link = document.createElement('link');
    link.href = `/assets/react-main.rtl.css?c=${
      window?.settings?.commit ?? ''
    }`;
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
 * @param {string} format - the format token used in the translation
 * @param {string} languageCode - the ietf language code (learn more @/config/client/i18n-languages)
 * @returns {string|any} - the formatted value
 *                         or the original value, if the value type or format not recognized)
 */
function format(
  value: unknown,
  format?: string,
  languageCode?: string,
): unknown {
  const locale = (languageCode || 'en').replace(/_/g, '-');
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) return 'Invalid date';
    return match(format)
      .with('fromNow', () => timeAgo(value, locale))
      .with('age', () => differenceInYears(new Date(), value))
      .with('LL', () => value.toLocaleDateString(locale, { dateStyle: 'long' }))
      .with('ll', () =>
        value.toLocaleDateString(locale, { dateStyle: 'medium' }),
      )
      .with('YYYY', () => String(value.getFullYear()))
      .with('MMMM Do', () =>
        locale.split('-')[0] === 'en'
          ? formatDate(value, 'MMMM do')
          : value.toLocaleDateString(locale, { month: 'long', day: 'numeric' }),
      )
      .otherwise(() => value);
  }

  if (typeof value === 'number' && format === 'number') {
    return value.toLocaleString(locale);
  }

  return value;
}

// i18next >= 21 ignores `interpolation.format` and uses its own formatter,
// so ours is registered as the formatter module.
const formatter = {
  type: 'formatter' as const,
  init() {},
  format: format as FormatFunction,
};

if (!isTest && typeof document !== 'undefined') i18n.use(localeBackend);

i18n.on('languageChanged', async (languageCode: string) => {
  if (typeof document === 'undefined') return;
  const direction = i18n.dir(languageCode);

  document.documentElement.lang = languageCode;
  document.documentElement.dir = direction;

  if (direction === 'rtl') {
    await loadRtlCSS();
  }
});

i18n
  .use(languageCookie)
  // pass the i18n instance to react-i18next.
  .use(initReactI18next)
  .use(formatter)
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
    },
    react: {
      useSuspense: false,
    },
    // debug: true, // show missing translation keys in console.log
  });

export default i18n;
