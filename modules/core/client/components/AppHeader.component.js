// External dependencies
import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Internal dependencies
import { $on } from '@/modules/core/client/services/angular-compat';
import { userType } from '@/modules/users/client/users.prop-types';
import NavigationLoggedIn from './NavigationLoggedIn';
import NavigationLoggedOut from './NavigationLoggedOut';

export default function AppHeader({
  user,
  onSignout,
  isI18nEnabled,
  onNavigation, //eslint-disable-line
}) {
  const { t } = useTranslation('core');
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  // Angular UI-router compatibility
  // Once we use React-Router or similar, this can be removed
  useEffect(() => {
    $on('$stateChangeSuccess', () => {
      setCurrentPath(window.location.pathname);
    });
  }, []);

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
        <NavigationLoggedIn
          onSignout={onSignout}
          user={user}
          currentPath={currentPath}
        />
      ) : (
        <NavigationLoggedOut
          isI18nEnabled={isI18nEnabled}
          currentPath={currentPath}
        />
      )}
    </header>
  );
}

AppHeader.propTypes = {
  isI18nEnabled: PropTypes.bool,
  onSignout: PropTypes.func.isRequired,
  user: userType,
};
