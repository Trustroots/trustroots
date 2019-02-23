import React from 'react';
import i18n from '@/config/client/i18n';
import locales from '@/config/shared/locales';

export default function LanguageSwitch() {
  const changeLanguage = (languageCode) => {
    i18n.changeLanguage(languageCode);
  };

  return (
    <select onChange={(event) => changeLanguage(event.target.value)}>
      {locales.map(({ code, label }) => (
        <option key={code} value={code}>{label}</option>
      ))}
    </select>
  );
};

LanguageSwitch.propTypes = {};
