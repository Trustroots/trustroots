// External dependencies
import PropTypes from 'prop-types';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Navbar } from 'react-bootstrap';

// Internal dependencies
import { useCurrentPath } from '@/modules/core/client/react-app/useCurrentPath';
import { userType } from '@/modules/users/client/users.prop-types';
import type { AuthUser } from '@/modules/core/client/react-app/auth';
import NavigationLoggedIn from './NavigationLoggedIn';
import NavigationLoggedOut from './NavigationLoggedOut';

type Props = {
  currentPath?: string;
  onSignout: (event?: React.MouseEvent<HTMLElement>) => void;
  user?: AuthUser | null;
};
export default function AppHeader({
  currentPath: routedPath,
  onSignout,
  user,
}: Props) {
  const { t } = useTranslation('core');
  const browserPath = useCurrentPath();
  const currentPath = routedPath || browserPath;
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // The effect runs after Navbar attaches its ref.
    const header = headerRef.current as HTMLElement;
    const updateHeight = () => {
      document.documentElement.style.setProperty(
        '--tr-header-height',
        `${header.getBoundingClientRect().height}px`,
      );
    };
    updateHeight();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateHeight);
      return () => {
        window.removeEventListener('resize', updateHeight);
        document.documentElement.style.removeProperty('--tr-header-height');
      };
    }

    const observer = new ResizeObserver(updateHeight);
    observer.observe(header);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--tr-header-height');
    };
  }, []);

  return (
    <Navbar className="hidden-print" id="tr-header" fixed="top" ref={headerRef}>
      <a
        className="btn btn-primary sr-only sr-only-focusable sr-helper"
        href="#tr-main"
      >
        {t<string>('Skip to main content')}
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
  currentPath: PropTypes.string,
  onSignout: PropTypes.func.isRequired,
  user: userType,
};
