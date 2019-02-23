import React from 'react';
import i18n from '@/config/client/i18n';
import languages from '@/config/client/i18n-languages';

export default function LanguageSwitch() {
  const changeLanguage = (languageCode) => {
    i18n.changeLanguage(languageCode);
  };

  return (
    <select onChange={(event) => changeLanguage(event.target.value)}>
      {languages.map(({ code, label }) => (
        <option key={code} value={code}>{label}</option>
      ))}
    </select>
  );
};

LanguageSwitch.propTypes = {};
