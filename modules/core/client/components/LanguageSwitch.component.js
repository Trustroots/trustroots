import React from 'react';
import i18n from '@/config/client/i18n';

export default function LanguageSwitch() {
  const changeLanguage = (languageCode) => {
    i18n.changeLanguage(languageCode);
  };

  return (
    <select onChange={(event) => changeLanguage(event.target.value)}>
      <option value="eng">eng</option>
      <option value="cze">cze</option>
    </select>
  );
};

LanguageSwitch.propTypes = {};
