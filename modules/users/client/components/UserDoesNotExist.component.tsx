// External dependencies
import { useTranslation } from 'react-i18next';
import { Button } from '@trustroots/ui/Button';
import React from 'react';

export default function UserDoesNotExist() {
  const { t } = useTranslation('users') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };

  return (
    <div className="row text-center" role="alert">
      <h1>{t('Oops!')}</h1>
      <em className="lead">
        {t('The person you are looking for is not available.')}
      </em>
      <br />
      <br />
      <Button colour="primary" render={<a href="/search/members" />}>
        {t('Find people')}
      </Button>
      <br />
      <br />
      <a href="/search">{t('Map search')}</a>
    </div>
  );
}
