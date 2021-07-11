// External dependencies
import { useTranslation } from 'react-i18next';
import React from 'react';

// Internal dependencies
import Icon from '@/modules/core/client/components/Icon';

export default function NoMeets() {
  const { t } = useTranslation('offers');

  return (
    <div className="content-empty">
      <Icon icon="users" size="3x" />
      <br />
      <p className="lead text-center">
        {t('Travelling? Organising an event?')}
        <br />
        {t('Just making a dinner and would like to invite people over?')}
        <br />
        <br />
      </p>
      <p>
        <a
          className="btn btn-action btn-inverse-primary"
          href="/offer/meet/add"
        >
          {t('Add it to map!')}
        </a>
        <br />
        <br />
      </p>
      <p className="lead text-center">
        {t('Meetups stay visible on map at most one month.')}
      </p>
    </div>
  );
}

NoMeets.propTypes = {};
