import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

export default function PublicReference({ reference }) {
  const { t } = useTranslation('reference');
  const created = new Date(reference.created);
  return (
    <div>
      <div>
        {reference.hostedMe && t('guest')} {reference.hostedThem && t('host')}{' '}
        {reference.met && t('met')}
      </div>
      <div>
        {t('Recommends: {{recommend}}', { recommend: reference.recommend })}
      </div>
      <div>{t('Given {{created, MMM D YYYY}}', { created })}</div>
    </div>
  );
}

PublicReference.propTypes = {
  reference: PropTypes.object.isRequired,
};
