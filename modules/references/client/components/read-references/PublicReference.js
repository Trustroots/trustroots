import { withTranslation } from '@/modules/core/client/utils/i18n-angular-load';
import PropTypes from 'prop-types';
import React from 'react';

export function PublicReference({ t, reference }) {
  const created = new Date(reference.created);
  return (
    <div>
      <div>
        {reference.hostedMe && t('guest')} {reference.hostedThem && t('host')} {reference.met && t('met')}
      </div>
      <div>
        {t('Recommends: {{recommend}}', { recommend: reference.recommend })}
      </div>
      <div>
        {t('Given {{created, MMM D YYYY}}', { created })}
      </div>
    </div>
  );
}

PublicReference.propTypes = {
  t: PropTypes.func.isRequired,
  reference: PropTypes.object.isRequired
};

export default withTranslation('reference')(PublicReference);
