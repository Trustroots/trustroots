// External dependencies
import { useTranslation } from 'react-i18next';
import React from 'react';

// Internal dependencies
import { Button } from '@trustroots/ui';
import LanguageSwitch from './LanguageSwitch';

export default function NavigationLoggedOut({
  currentPath,
}: {
  currentPath: string;
}) {
  const { t } = useTranslation('core');

  return (
    <div className="container w-100">
      <nav
        aria-label={t<string>('Page navigation')}
        className="header-welcome text-center"
        role="navigation"
      >
        {/* a span for centering the main header content */}
        <span className="flex-side"></span>
        <span className="header-welcome-text hidden-xs" dir="auto">
          {t<string>('New to Trustroots?')}
        </span>
        <Button as="a" href="/signup" size="lg" variant="default">
          {t<string>('Join')}
        </Button>
        <Button as="a" href="/signin" size="lg" variant="inverse">
          {t<string>('Login')}
        </Button>
        {currentPath !== '/' && (
          <Button
            as="a"
            aria-label={t<string>('Read more about Trustroots')}
            variant="link"
            className="header-more-text hidden-xs"
            href="/"
          >
            {t<string>('Read more')}
          </Button>
        )}
        <div className="flex-side language-switch">
          <LanguageSwitch buttonStyle="inverse" />
        </div>
      </nav>
    </div>
  );
}
