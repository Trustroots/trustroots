import i18n from 'i18next';
import { reactI18nextModule } from 'react-i18next';
import backend from 'i18next-xhr-backend';
import moment from 'moment';

// translations are already at
// '../public/locales/**/translation.json'
// which is the default for the xhr backend to load from

/**
 * Format a translation parameter
 */
function format(value, format, languageCode) {
  // these are the codes that momentjs supports
  // we could replace the 3letter codes with these
  // these seem to be more widely used (wikipedia in different languages, momentjs, ...)
  const codes = {
    eng: 'en',
    cze: 'cs'
  };

  if (value instanceof Date) {
    moment.locale(codes[languageCode]);
    if (format === 'fromNow') return moment(value).fromNow();
    return moment(value).format(format);
  }
  return value;
}

i18n
  .use(backend)
  .use(reactI18nextModule) // passes i18n down to react-i18next
  .init({
    lng: 'eng',
    // allow keys to be phrases having `:`, `.`
    nsSeparator: false,
    keySeparator: false,
    // saveMissing: true, // @TODO send not translated keys to endpoint
    keySeparator: false, // we do not use keys in form messages.welcome
    interpolation: {
      escapeValue: false, // react already safes from xss
      format
    }
    // debug: true // show missing translation keys in console.log
  });

export default i18n;
