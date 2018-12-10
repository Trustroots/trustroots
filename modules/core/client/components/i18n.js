import i18n from 'i18next';
import { reactI18nextModule } from 'react-i18next';
import * as translationENG from '@/public/locales/eng/translation';
import * as translationCZE from '@/public/locales/cze/translation';

// the translations
// (tip move them in a JSON file and import them)
const resources = {
  eng: {
    translation: translationENG
  },
  cze: {
    translation: translationCZE
  }
};

i18n
  .use(reactI18nextModule) // passes i18n down to react-i18next
  .init({
    resources,
    lng: 'eng',

    keySeparator: false, // we do not use keys in form messages.welcome

    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
