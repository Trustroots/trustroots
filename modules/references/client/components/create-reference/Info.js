import React from 'react';
import PropTypes from 'prop-types';
import '@/config/client/i18n';
import { useTranslation, Trans } from 'react-i18next';

// @TODO provide the value from API config endpoint
const daysToReply = 14;

/**
 * Link to a user
 * @param {User} user - user to link to
 */
function UserLink({ user }) {
  return (
    <strong>
      <a href={`/profile/${user.username}`}>
        {user.displayName || user.username}
      </a>
    </strong>
  );
}

UserLink.propTypes = {
  user: PropTypes.object.isRequired,
};

/**
 * Error message when trying to give a reference to oneself.
 */
export function ReferenceToSelfInfo() {
  const { t } = useTranslation('reference');

  return (
    <div role="alert" className="alert alert-warning">
      {t("Sorry, you can't give a reference to yourself.")}
    </div>
  );
}

/**
 * Info that data are loading.
 */
export function LoadingInfo() {
  const { t } = useTranslation('reference');

  return (
    <div role="alert" aria-busy="true" className="alert alert-warning">
      {t('Wait a moment...')}
    </div>
  );
}

/**
 * Error message when reference was already given
 * @param {User} userTo
 */
export function DuplicateInfo({ userTo }) {
  return (
    <div role="alert" className="alert alert-warning">
      <Trans ns="reference">
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
  const { t } = useTranslation('reference');

  const name = userTo.displayName || userTo.username;

  const isPublicMessage = isPublic ? (
    <>
      <div>
        <Trans ns="reference">
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
      <Trans ns="reference" daysToReply={daysToReply}>
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
          <Trans ns="reference">
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
