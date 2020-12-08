// External dependencies
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';

// Internal dependencies
import '@/config/client/i18n';
import SuccessMessage from '@/modules/core/client/components/SuccessMessage';

/**
 * Error message when reference was already given
 */
export default function DuplicateInfo({ username }) {
  const { t } = useTranslation('references');
  return (
    <SuccessMessage
      title={t('You already shared your experience with them')}
      cta={
        <a href={`/profile/${username}/references`} className="btn btn-primary">
          {t('See their experiences')}
        </a>
      }
    ></SuccessMessage>
  );
}

DuplicateInfo.propTypes = {
  username: PropTypes.string.isRequired,
};
