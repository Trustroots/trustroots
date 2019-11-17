import React from 'react';
import PropTypes from 'prop-types';
import { Dropdown, MenuItem } from 'react-bootstrap';
import locales from '@/config/shared/locales';

/**
 * A presentational component of LanguageSwitch.
 * Is used in header for non-logged users.
 * @param {String} currentLanguageCode - code of current language
 * @param {Function} onChangeLanguage - what to do when language is changed
 */
export function LanguageSwitchDropdown({ currentLanguageCode, onChangeLanguage }) {
  // selected language
  const currentLanguage = locales.find(language => language.code === currentLanguageCode);

  return (
    <Dropdown
      bsSize="large"
      title={currentLanguage.label}
      id={`dropdown-basic-${currentLanguage.code}`}
      pullRight
      className="disable-hover-display"
    >
      <Dropdown.Toggle className="btn-inverse">
        {currentLanguage.label}
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {locales.map(({ code, label }) => (
          <MenuItem key={code} onClick={() => onChangeLanguage(code)} active={code === currentLanguageCode}>
            {label}
          </MenuItem>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
}

/**
 * A presentational component of LanguageSwitch.
 * Is used in user's account.
 * Params are the same as for LanguageSwitchDropdownPresentation.
 */
export function LanguageSwitchSelect({ currentLanguageCode, onChangeLanguage }) {
  return (
    <select
      className="form-control"
      id="locale"
      value={currentLanguageCode}
      onChange={(event) => onChangeLanguage(event.target.value)}
    >
      {locales.map(({ code, label }) => (
        <option key={code} value={code} >
          {label}
        </option>
      ))}
    </select>
  );
}

LanguageSwitchSelect.propTypes = LanguageSwitchDropdown.propTypes = {
  currentLanguageCode: PropTypes.string,
  onChangeLanguage: PropTypes.func
};
