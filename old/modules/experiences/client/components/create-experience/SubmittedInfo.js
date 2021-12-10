// External dependencies
import { useTranslation, Trans } from 'react-i18next';
import PropTypes from 'prop-types';
import React from 'react';

// Internal dependencies
import '@/config/client/i18n';
import { DAYS_TO_REPLY } from '../../utils/constants';
import SuccessMessage from '@/modules/core/client/components/SuccessMessage';

/**
 * Info after successful submitting of a new experience.
 */
export default function SubmittedInfo({
  isPublic,
  isReported,
  name,
  username,
}) {
  const { t } = useTranslation('experiences');

  return (
    <SuccessMessage
      title={t('Thank you for sharing your experience!')}
      cta={
        <a
          className="btn btn-primary"
          href={`/profile/${username}/experiences`}
        >
          {t('See their experiences')}
        </a>
      }
    >
      <p>
        {isPublic
          ? t('Your experience with {{name}} is public now.', { name })
          : t(
              'Your experience will become public when {{name}} shares their experience, or at most in {{count}} days.',
              { name, count: DAYS_TO_REPLY },
            )}
      </p>

      {isReported && (
        <p>
          {/* @TODO remove ns (issue #1368) */}
          <Trans t={t} ns="experiences">
            You also reported them to us. Please do{' '}
            <a href="/support">get in touch with us</a> if you have any further
            info to add.
          </Trans>
        </p>
      )}
    </SuccessMessage>
  );
}

SubmittedInfo.propTypes = {
  isPublic: PropTypes.bool.isRequired,
  isReported: PropTypes.bool.isRequired,
  name: PropTypes.string.isRequired,
  username: PropTypes.string.isRequired,
};
