import i18n from 'i18next';
import { reactI18nextModule } from 'react-i18next';
import * as translationEN from '../../../../public/locales/en/translation';
import * as translationCS from '../../../../public/locales/cs/translation';

// the translations
// (tip move them in a JSON file and import them)
const resources = {
  en: {
    translation: translationEN
  },
  cs: {
    translation: translationCS
  }
};

i18n
  .use(reactI18nextModule) // passes i18n down to react-i18next
  .init({
    resources,
    lng: 'en',

    keySeparator: false, // we do not use keys in form messages.welcome

    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
