import React from 'react';
import PropTypes from 'prop-types';
import { withNamespaces } from 'react-i18next';

export function PublicReference({ t, reference }) {
  const created = new Date(reference.created);
  return (
    <div>
      <div>
        {reference.hostedMe && 'guest'} {reference.hostedThem && 'host'} {reference.met && 'met'}
      </div>
      <div>
        Recommends: {reference.recommend}
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

export default withNamespaces('reference')(PublicReference);
