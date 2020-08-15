import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

export default function PublicReference({ reference }) {
  const { t } = useTranslation('references');
  const created = new Date(reference.created);
  const { hostedMe, hostedThem, met, recommend } = reference;

  return (
    <div>
      <div>
        {hostedMe && t('guest')} {hostedThem && t('host')} {met && t('met')}
      </div>
      <div>{t('Recommends: {{recommend}}', { recommend })}</div>
      <div>{t('Given {{created, MMM D YYYY}}', { created })}</div>
    </div>
  );
}

PublicReference.propTypes = {
  reference: PropTypes.object.isRequired,
};
