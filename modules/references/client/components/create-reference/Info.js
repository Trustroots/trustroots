import React from 'react';
import PropTypes from 'prop-types';
import '@/config/lib/i18n';
import { withNamespaces } from 'react-i18next';

// @TODO provide the value from API config endpoint
const timeToReplyReference = { days: 14 };

/**
 * Link to a user
 * @param {User} user - user to link to
 */
function UserLink({ user }) {
  return (<strong><a href={`/profile/${user.username}`}>{user.displayName || user.username}</a></strong>);
}

UserLink.propTypes = {
  user: PropTypes.object.isRequired
};

/**
 * Error message when trying to give a reference to oneself.
 */
export const ReferenceToSelfInfo = withNamespaces('reference')(function ({ t }) {
  return (<div className="alert alert-warning">{t('Sorry, you can\'t give a reference to yourself.')}</div>);
});

/**
 * Info that data are loading.
 */
export const LoadingInfo = withNamespaces('reference')(function ({ t }) {
  return (<div className="alert alert-warning">{t('Wait a moment...')}</div>);
});

/**
 * Error message when reference was already given
 * @param {User} userTo
 */
export function DuplicateInfo({ userTo }) {
  return (<div className="alert alert-warning">You&apos;ve already given a reference to <UserLink user={userTo} />.</div>);
}

DuplicateInfo.propTypes = {
  userTo: PropTypes.object.isRequired
};

/**
 * Info after successful submitting of a new reference.
 */
export function SubmittedInfo({ isReported, isPublic, userFrom, userTo }) {
  const name = userTo.displayName || userTo.username;

  const isPublicMessage = (isPublic) ?
    (
      <>
      <div><a href={`/profile/${userTo.username}/references`}>Your reference</a> for <UserLink user={userTo} /> is public now.</div>
      <div><a href={`/profile/${userFrom.username}/references`}>See the reference from {name} to you.</a></div>
      </>
    ) :
    (
      <div>Your reference will become public when <UserLink user={userTo} /> gives you a reference back, or in {timeToReplyReference.days} days.</div>
    );

  return (
    <div className="alert alert-success">
      <div>Done!</div>
      <div>{isPublicMessage}</div>
      {isReported && <div>Also, <UserLink user={userTo} /> was reported.</div>}
    </div>
  );
}

SubmittedInfo.propTypes = {
  userFrom: PropTypes.object.isRequired,
  userTo: PropTypes.object.isRequired,
  isReported: PropTypes.bool.isRequired,
  isPublic: PropTypes.bool.isRequired
};
