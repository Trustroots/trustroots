import React from 'react';
import i18n from '@/config/client/i18n';
import locales from '@/config/shared/locales';
import PropTypes from 'prop-types';
import { Dropdown, MenuItem } from 'react-bootstrap';

function LanguageSwitchPresentation({ currentLanguageCode, onChangeLanguage }) {
  // selected language
  const currentLanguage = locales.find(language => language.code === currentLanguageCode);
  // languages which are not selected
  const otherLanguages = locales.filter(language => language.code !== currentLanguageCode);

  return (
    <Dropdown
      bsSize="large"
      title={currentLanguage.name}
      id={`dropdown-basic-${currentLanguage.code}`}
      pullRight
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

LanguageSwitchPresentation.propTypes = {
  currentLanguageCode: PropTypes.string,
  onChangeLanguage: PropTypes.func
};

export default class LanguageSwitch extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      currentLanguageCode: 'en'
    };

    // bind class context to class methods
    this.handleChangeLanguage = this.handleChangeLanguage.bind(this);
  }

  handleChangeLanguage(languageCode) {
    this.setState(() => ({ currentLanguageCode: languageCode }));
    i18n.changeLanguage(languageCode);
  }

  render() {
    return (
      <LanguageSwitchPresentation
        currentLanguageCode={this.state.currentLanguageCode}
        onChangeLanguage={this.handleChangeLanguage}
      />
    );
  }
}

LanguageSwitch.propTypes = {};
