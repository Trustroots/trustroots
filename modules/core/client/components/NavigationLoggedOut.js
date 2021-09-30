// External dependencies
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';
import { brandName } from '@/modules/core/client/utils/constants';

// Internal dependencies
import LanguageSwitch from './LanguageSwitch';

export default function NavigationLoggedOut({ currentPath }) {
  const { t } = useTranslation('core');

  return (
    <div className="container">
      <nav
        aria-label={t('Page navigation')}
        className="header-welcome text-center"
        role="navigation"
      >
        {/* a span for centering the main header content */}
        <span className="flex-side"></span>
        <span className="header-welcome-text hidden-xs">
          {t('New to {{brandName}}?', {
            brandName,
          })}
        </span>
        <a href="/signup" className="btn btn-lg btn-default">
          {t('Join')}
        </a>
        <a href="/signin" className="btn btn-lg btn-inverse">
          {t('Login')}
        </a>
        {currentPath !== '/' && (
          <a
            aria-label={t('Read more about Trustroots')}
            className="btn btn-link header-more-text"
            href="/"
          >
            {t('Read more')}
          </a>
        )}
        <div className="flex-side language-switch">
          <LanguageSwitch buttonStyle="inverse" />
        </div>
      </nav>
    </div>
  );
}

NavigationLoggedOut.propTypes = {
  currentPath: PropTypes.string.isRequired,
};
