import React from 'react';
import i18n from './i18n';
import PropTypes from 'prop-types';
import { Dropdown, MenuItem } from 'react-bootstrap';

function LanguageSwitchPresentation({ currentLanguageCode, languages, onChangeLanguage }) {
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

LanguageSwitchPresentation.propTypes = {
  currentLanguageCode: PropTypes.string,
  languages: PropTypes.array,
  onChangeLanguage: PropTypes.func
};

export default class LanguageSwitch extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      currentLanguageCode: 'eng',
      languages: [
        { name: 'English', code: 'eng' },
        { name: 'Suomi', code: 'fin' },
        { name: 'Česky', code: 'cze' }
      ]
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
        languages={this.state.languages}
        onChangeLanguage={this.handleChangeLanguage}
      />
    );
  }
}

LanguageSwitch.propTypes = {};
