// External dependencies
import PropTypes from 'prop-types';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Navbar } from 'react-bootstrap';

// Internal dependencies
import { useCurrentPath } from '@/modules/core/client/react-app/useCurrentPath';
import { userType } from '@/modules/users/client/users.prop-types';
import NavigationLoggedIn from './NavigationLoggedIn';
import NavigationLoggedOut from './NavigationLoggedOut';

export default function AppHeader({ onSignout, user }) {
  const { t } = useTranslation('core');
  const currentPath = useCurrentPath();

  return (
    <Navbar className="hidden-print" id="tr-header" fixedTop>
      <a
        className="btn btn-primary sr-only sr-only-focusable sr-helper"
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
        <NavigationLoggedOut currentPath={currentPath} />
      )}
    </Navbar>
  );
}

AppHeader.propTypes = {
  onSignout: PropTypes.func.isRequired,
  user: userType,
};
