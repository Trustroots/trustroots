import { withTranslation } from '@/modules/core/client/utils/i18n-angular-load';
import PropTypes from 'prop-types';
import React from 'react';

export function NonpublicReference({ t, reference }) {
  const daysLeft = 14 - Math.round((Date.now() - new Date(reference.created).getTime()) / 3600 / 24 / 1000);
  return (
    <div>
      <div><small>{t('pending')}</small></div>
      <div>{t('{{daysLeft}} days left', { daysLeft })}</div>
      <div>
        <a
          className="btn btn-xs btn-primary"
          href={`/profile/${reference.userFrom.username}/references/new`}
        >{t('Give a reference')}</a>
      </div>
    </div>
  );
}

NonpublicReference.propTypes = {
  t: PropTypes.func.isRequired,
  reference: PropTypes.object.isRequired
};

export default withTranslation('reference')(NonpublicReference);
