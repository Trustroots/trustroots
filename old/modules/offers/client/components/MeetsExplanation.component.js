// External dependencies
import { useTranslation } from 'react-i18next';
import React from 'react';

// Internal dependencies
import Icon from '@/modules/core/client/components/Icon';

export default function MeetsExplanation() {
  const { t } = useTranslation('offers');

  return (
    <>
      <Icon icon="users" size="3x" className="text-muted hidden-xs" />
      <p className="lead">
        <strong>
          {t(
            'Travelling? Organising an event? Just making a dinner and would like to invite people over?',
          )}
        </strong>
        <br />
        <br />
        {t('Meetups stay visible on map at most one month.')}
      </p>
    </>
  );
}

MeetsExplanation.propTypes = {};
