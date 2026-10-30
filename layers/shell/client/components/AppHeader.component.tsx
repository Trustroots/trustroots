import React, { useEffect, useRef } from 'react';
import { useLocation } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Navbar } from 'react-bootstrap';

// Internal dependencies
import type { AuthUser } from '@/modules/core/client/react-app/auth';
import NavigationLoggedIn from './NavigationLoggedIn';
import NavigationLoggedOut from './NavigationLoggedOut';

type Props = {
  currentPath?: string;
  user?: AuthUser | null;
};
export default function AppHeader({ currentPath: routedPath, user }: Props) {
  const { t } = useTranslation('core');
  const browserPath = useLocation({ select: location => location.pathname });
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
        onClick={event => {
          // The document base URL points at '/', so native hash navigation
          // would leave the current page. Move keyboard focus directly.
          event.preventDefault();
          document.getElementById('tr-main')?.focus();
        }}
      >
        {t('Skip to main content')}
      </a>
      {user?.username ? (
        <NavigationLoggedIn user={user} currentPath={currentPath} />
      ) : (
        <NavigationLoggedOut currentPath={currentPath} />
      )}
    </Navbar>
  );
}
