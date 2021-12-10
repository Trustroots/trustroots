// External dependencies
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';

// Internal dependencies
import '@/config/client/i18n';
import SuccessMessage from '@/modules/core/client/components/SuccessMessage';

/**
 * Error message when experience was already shared
 */
export default function DuplicateInfo({ username }) {
  const { t } = useTranslation('experiences');
  return (
    <SuccessMessage
      title={t('You already shared your experience with them')}
      cta={
        <a
          className="btn btn-primary"
          href={`/profile/${username}/experiences`}
        >
          {t('See their experiences')}
        </a>
      }
    ></SuccessMessage>
  );
}

DuplicateInfo.propTypes = {
  username: PropTypes.string.isRequired,
};
