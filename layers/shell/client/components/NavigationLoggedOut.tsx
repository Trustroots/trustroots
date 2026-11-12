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
    <div className="container tw:flex tw:min-h-[43px] tw:items-center">
      <nav
        aria-label={t('Page navigation')}
        className="header-welcome tw:flex tw:flex-1 tw:items-center tw:justify-center tw:py-1.25 tw:text-center"
        role="navigation"
      >
        {/* a span for centering the main header content */}
        <span className="tw:flex-1"></span>
        <span className="header-welcome-text hidden-xs" dir="auto">
          {t('New to Trustroots?')}
        </span>
        <Button size="lg" render={<a href="/signup" />}>
          {t('Join')}
        </Button>
        <Button
          variant="outline"
          intent="inverse"
          size="lg"
          render={<a href="/signin" />}
        >
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
        <div className="tw:flex tw:flex-1 tw:justify-end">
          <LanguageSwitch buttonStyle="inverse" />
        </div>
      </nav>
    </div>
  );
}
