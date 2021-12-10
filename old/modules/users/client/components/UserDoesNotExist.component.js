// External dependencies
import { useTranslation } from 'react-i18next';
import React from 'react';

export default function UserDoesNotExist() {
  const { t } = useTranslation('users');

  return (
    <div className="row text-center" role="alert">
      <h1>{t('Oops!')}</h1>
      <em className="lead">
        {t('The person you are looking for is not available.')}
      </em>
      <br />
      <br />
      <a href="/search/members" className="btn btn-primary">
        {t('Find people')}
      </a>
      <br />
      <br />
      <a href="/search">{t('Map search')}</a>
    </div>
  );
}

UserDoesNotExist.propTypes = {};
