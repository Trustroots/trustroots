// External dependencies
import PropTypes from 'prop-types';
import React from 'react';
import { useTranslation } from 'react-i18next';

// Internal dependencies
import { userType } from '@/modules/users/client/users.prop-types';
import NavigationLoggedIn from './NavigationLoggedIn';
import NavigationLoggedOut from './NavigationLoggedOut';

export default function AppHeader({ user, onSignout, isI18nEnabled }) {
  const { t } = useTranslation('core');

  const path = window.location.pathname;

  return (
    <header
      className="navbar navbar-default navbar-fixed-top hidden-print"
      id="tr-header"
      role="banner"
    >
      <a
        className="btn btn-default sr-only sr-only-focusable sr-helper"
        href="#tr-main"
      >
        {t('Skip to main content')}
      </a>

      {user?.username ? (
        <NavigationLoggedIn path={path} onSignout={onSignout} user={user} />
      ) : (
        <NavigationLoggedOut path={path} isI18nEnabled={isI18nEnabled} />
      )}
    </header>
  );
}

AppHeader.propTypes = {
  isI18nEnabled: PropTypes.bool,
  onSignout: PropTypes.func.isRequired,
  path: PropTypes.string,
  user: userType,
};
