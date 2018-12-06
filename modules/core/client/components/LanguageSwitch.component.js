import React from 'react';
import i18n from './i18n';

export default function LanguageSwitch() {
  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  return (
    <select onChange={(event) => changeLanguage(event.target.value)}>
      <option value="en">en</option>
      <option value="cs">cs</option>
    </select>
  );
};

LanguageSwitch.propTypes = {};
