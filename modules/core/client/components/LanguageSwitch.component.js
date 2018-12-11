import React from 'react';
import PropTypes from 'prop-types';
import { Dropdown, MenuItem } from 'react-bootstrap';
import LanguageSwitchContainer from './LanguageSwitchContainer';

function LanguageSwitchDropdownPresentation({ currentLanguageCode, languages, onChangeLanguage }) {
  // languages which are not selected
  const otherLanguages = languages.filter(language => language.code !== currentLanguageCode);
  const currentLanguage = languages.find(language => language.code === currentLanguageCode);

  return (
    <Dropdown
      bsSize="large"
      title={currentLanguage.name}
      id={`dropdown-basic-${currentLanguage.code}`}
      pullRight
    >
      <Dropdown.Toggle className="btn-inverse">
        {currentLanguage.name}
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {otherLanguages.map(language => (
          <MenuItem key={language.code} onClick={() => onChangeLanguage(language.code)}>
            {language.name}
          </MenuItem>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
};

LanguageSwitchDropdownPresentation.propTypes = {
  currentLanguageCode: PropTypes.string,
  languages: PropTypes.array,
  onChangeLanguage: PropTypes.func
};

function LanguageSwitchSelectPresentation({ currentLanguageCode, languages, onChangeLanguage }) {
  return (
    <select
      className="form-control"
      id="locale"
      value={currentLanguageCode}
      onChange={(event) => onChangeLanguage(event.target.value)}
    >
      {languages.map(language => (
        <option key={language.code} value={language.code} >
          {language.name}
        </option>
      ))}
    </select>
  );
};

LanguageSwitchSelectPresentation.propTypes = {
  currentLanguageCode: PropTypes.string,
  languages: PropTypes.array,
  onChangeLanguage: PropTypes.func
};

export default function LanguageSwitch({ presentation='dropdown' }) {
  return (
    <LanguageSwitchContainer presentation={
      (presentation === 'dropdown') ? LanguageSwitchDropdownPresentation : LanguageSwitchSelectPresentation
    } />
  );
}

LanguageSwitch.propTypes = {
  presentation: PropTypes.string
};
