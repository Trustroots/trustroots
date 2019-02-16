import React from 'react';
import PropTypes from 'prop-types';
import LanguageSwitchContainer from './LanguageSwitchContainer';
import { LanguageSwitchDropdownPresentation, LanguageSwitchSelectPresentation } from './LanguageSwitchPresentational';

/**
 * The main LanguageSwitch component.
 * @param {'dropdown'|'select'} presentation - should we show dropdown (header), or select (account) selector?
 * @param {Boolean} [saveToAPI=false] - should we save selected language to API?
 */
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
