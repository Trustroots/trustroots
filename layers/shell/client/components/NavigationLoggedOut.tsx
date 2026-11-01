// External dependencies
import { useTranslation } from 'react-i18next';
import { Button } from '@trustroots/ui/Button';
import React from 'react';

// Internal dependencies
import LanguageSwitch from '@/modules/core/client/components/LanguageSwitch';

export default function NavigationLoggedOut({
  currentPath,
}: {
  currentPath: string;
}) {
  const { t } = useTranslation('core');

  return (
    <div className="container w-100">
      <nav
        aria-label={t('Page navigation')}
        className="header-welcome text-center"
        role="navigation"
      >
        {/* a span for centering the main header content */}
        <span className="flex-side"></span>
        <span className="header-welcome-text hidden-xs" dir="auto">
          {t('New to Trustroots?')}
        </span>
        <Button size="lg" render={<a href="/signup" />}>
          {t('Join')}
        </Button>
        <Button variant="inverse" size="lg" render={<a href="/signin" />}>
          {t('Login')}
        </Button>
        {currentPath !== '/' && (
          <Button
            variant="link"
            aria-label={t('Read more about Trustroots')}
            className="header-more-text hidden-xs"
            render={<a href="/" />}
          >
            {t('Read more')}
          </Button>
        )}
        <div className="flex-side language-switch">
          <LanguageSwitch buttonStyle="inverse" />
        </div>
      </nav>
    </div>
  );
}
