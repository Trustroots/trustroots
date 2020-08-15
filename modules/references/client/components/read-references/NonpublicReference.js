import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

export default function NonpublicReference({ reference }) {
  const { t } = useTranslation('references');

  const daysLeft =
    14 -
    Math.round(
      (Date.now() - new Date(reference.created).getTime()) / 3600 / 24 / 1000,
    );
  return (
    <div>
      <div>
        <small>{t('pending')}</small>
      </div>
      <div>{t('{{daysLeft}} days left', { daysLeft })}</div>
      <div>
        <a
          className="btn btn-xs btn-primary"
          href={`/profile/${reference.userFrom.username}/references/new`}
        >
          {t('Give a reference')}
        </a>
      </div>
    </div>
  );
}

NonpublicReference.propTypes = {
  reference: PropTypes.object.isRequired,
};
