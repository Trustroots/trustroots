import React from 'react';
import PropTypes from 'prop-types';
import '@/config/client/i18n';
import { useTranslation, Trans } from 'react-i18next';
import UserLink from '@/modules/users/client/components/UserLink';

// @TODO provide the value from API config endpoint
const daysToReply = 14;

/**
 * Error message when trying to give a reference to oneself.
 */
export function ReferenceToSelfInfo() {
  const { t } = useTranslation('references');

  return (
    <div role="alert" className="alert alert-warning">
      {t("Sorry, you can't give a reference to yourself.")}
    </div>
  );
}

/**
 * Error message when reference was already given
 * @param {User} userTo
 */
export function DuplicateInfo({ userTo }) {
  const { t } = useTranslation('references');
  return (
    <div role="alert" className="alert alert-warning">
      {/* @TODO remove ns (issue #1368) */}
      <Trans t={t} ns="references">
        You&apos;ve already given a reference to <UserLink user={userTo} />.
      </Trans>
    </div>
  );
}

DuplicateInfo.propTypes = {
  userTo: PropTypes.object.isRequired,
};

/**
 * Info after successful submitting of a new reference.
 */
export function SubmittedInfo({ isReported, isPublic, userFrom, userTo }) {
  const { t } = useTranslation('references');

  const name = userTo.displayName || userTo.username;

  const isPublicMessage = isPublic ? (
    <>
      <div>
        {/* @TODO remove ns (issue #1368) */}
        <Trans t={t} ns="references">
          <a href={`/profile/${userTo.username}/references`}>Your reference</a>{' '}
          for <UserLink user={userTo} /> is public now.
        </Trans>
      </div>
      <div>
        <a href={`/profile/${userFrom.username}/references`}>
          {t('See the reference from {{name}} to you.', name)}
        </a>
      </div>
    </>
  ) : (
    <div>
      {/* @TODO remove ns (issue #1368) */}
      <Trans t={t} ns="references" daysToReply={daysToReply}>
        Your reference will become public when <UserLink user={userTo} /> gives
        you a reference back, or in {{ daysToReply }} days.
      </Trans>
    </div>
  );

  return (
    <div role="alert" className="alert alert-success">
      <div>{t('Done!')}</div>
      <div>{isPublicMessage}</div>
      {isReported && (
        <div>
          {/* @TODO remove ns (issue #1368) */}
          <Trans t={t} ns="references">
            Also, <UserLink user={userTo} /> was reported.
          </Trans>
        </div>
      )}
    </div>
  );
}

SubmittedInfo.propTypes = {
  userFrom: PropTypes.object.isRequired,
  userTo: PropTypes.object.isRequired,
  isReported: PropTypes.bool.isRequired,
  isPublic: PropTypes.bool.isRequired,
};
