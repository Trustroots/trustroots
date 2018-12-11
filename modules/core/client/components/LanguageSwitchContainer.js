import React from 'react';
import i18n from './i18n';
import PropTypes from 'prop-types';

export default class LanguageSwitchContainer extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      currentLanguageCode: i18n.language,
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
      <this.props.presentation
        currentLanguageCode={this.state.currentLanguageCode}
        languages={this.state.languages}
        onChangeLanguage={this.handleChangeLanguage}
      />
    );
  }
}

LanguageSwitchContainer.propTypes = {
  presentation: PropTypes.func.isRequired
};
