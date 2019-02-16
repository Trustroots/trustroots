import React from 'react';
import locales from '@/config/shared/locales';
import PropTypes from 'prop-types';
import { Dropdown, MenuItem } from 'react-bootstrap';
import LanguageSwitchContainer from './LanguageSwitchContainer';

function LanguageSwitchDropdownPresentation({ currentLanguageCode, onChangeLanguage }) {
  // languages which are not selected
  const otherLanguages = locales.filter(language => language.code !== currentLanguageCode);
  // selected language
  const currentLanguage = locales.find(language => language.code === currentLanguageCode);

  return (
    <Dropdown
      bsSize="large"
      title={currentLanguage.name}
      id={`dropdown-basic-${currentLanguage.code}`}
      pullRight
      className="disable-hover-display"
    >
      <Dropdown.Toggle className="btn-inverse">
        {currentLanguage.label}
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {otherLanguages.map(({ code, label }) => (
          <MenuItem key={code} onClick={() => onChangeLanguage(code)}>
            {label}
          </MenuItem>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
};

LanguageSwitchDropdownPresentation.propTypes = {
  currentLanguageCode: PropTypes.string,
  onChangeLanguage: PropTypes.func
};

function LanguageSwitchSelectPresentation({ currentLanguageCode, onChangeLanguage }) {
  return (
    <select
      className="form-control"
      id="locale"
      value={currentLanguageCode}
      onChange={(event) => onChangeLanguage(event.target.value)}
    >
      {locales.map(language => (
        <option key={language.code} value={language.code} >
          {language.name}
        </option>
      ))}
    </select>
  );
};

LanguageSwitchSelectPresentation.propTypes = {
  currentLanguageCode: PropTypes.string,
  onChangeLanguage: PropTypes.func
};

export default function LanguageSwitch({ presentation='dropdown', saveToAPI=false }) {
  return (
    <LanguageSwitchContainer presentation={
      (presentation === 'dropdown') ? LanguageSwitchDropdownPresentation : LanguageSwitchSelectPresentation
    } saveToAPI={saveToAPI} />
  );
}

LanguageSwitch.propTypes = {
  presentation: PropTypes.string,
  saveToAPI: PropTypes.bool
};
