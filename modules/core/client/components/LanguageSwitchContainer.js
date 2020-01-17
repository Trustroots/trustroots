import React from 'react';
import i18n from '@/config/client/i18n';
import PropTypes from 'prop-types';
import * as users from '@/modules/users/client/api/users.api';

const api = { users };

/**
 * Smart component for Language switch.
 * It expects (as Component attributes):
 * @param {Component} presentation - a presentational component with props:
 *   - currentLanguageCode
 *   - languages
 *   - onChangeLanguage
 * @param {Boolean} saveToAPI - save the selection to API or not?
 */
export default class LanguageSwitchContainer extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      currentLanguageCode: i18n.language,
    };

    // bind class context to class methods
    this.handleChangeLanguage = this.handleChangeLanguage.bind(this);
  }

  async handleChangeLanguage(languageCode) {
    this.setState(() => ({ currentLanguageCode: languageCode }));
    i18n.changeLanguage(languageCode);

    // save the user's choice to api
    if (this.props.saveToAPI) {
      // @TODO this needs some feedback. Currently no feedback to user that this was saved.
      await api.users.update({ locale: languageCode });
    }
  }

  render() {
    return (
      <this.props.presentation
        currentLanguageCode={this.state.currentLanguageCode}
        onChangeLanguage={this.handleChangeLanguage}
      />
    );
  }
}

LanguageSwitchContainer.propTypes = {
  presentation: PropTypes.func.isRequired,
  saveToAPI: PropTypes.bool.isRequired,
};
