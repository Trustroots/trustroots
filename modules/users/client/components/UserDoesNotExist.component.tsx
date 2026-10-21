// External dependencies
import { useTranslation } from 'react-i18next';
import React from 'react';
import { Button } from '@trustroots/ui';

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
      <Button as="a" href="/search/members" variant="primary">
        {t('Find people')}
      </Button>
      <br />
      <br />
      <a href="/search">{t('Map search')}</a>
    </div>
  );
}
