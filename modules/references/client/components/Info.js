import React from 'react';
import PropTypes from 'prop-types';
// TODO we can't use the config/config for some reason
import * as config from '../../../../config/env/default';

/**
 * @TODO make these elements nicer
 */

function UserLink({ user }) {
  return (<strong><a href={`/profile/${user.username}`}>{user.displayName || user.username}</a></strong>);
}

UserLink.propTypes = {
  user: PropTypes.object.isRequired
};

export function Self() {
  return (<div className="alert alert-warning">Sorry, you can&apos;t give a reference to yourself.</div>);
}

export function Loading() {
  return (<div className="alert alert-warning">Loading</div>);
}

export function Duplicate({ userTo }) {
  return (<div className="alert alert-warning">You&apos;ve already given a reference to <UserLink user={userTo} />.</div>);
}

Duplicate.propTypes = {
  userTo: PropTypes.object.isRequired
};

export function Submitted({ isReported, isPublic, userFrom, userTo }) {
  const name = userTo.displayName || userTo.username;

  const isPublicMessage = (isPublic) ?
    (
      <>
      <div><a href={`/profile/${userTo.username}/references`}>Your reference</a> for <UserLink user={userTo} /> is public now.</div>
      <div><a href={`/profile/${userFrom.username}/references`}>See the reference from {name} to you.</a></div>
      </>
    ) :
    (
      <div>Your reference will become public when <UserLink user={userTo} /> gives you a reference back, or in {config.limits.timeToReplyReference.days} days.</div>
    );

  return (
    <div className="alert alert-success">
      <div>Done!</div>
      <div>{isPublicMessage}</div>
      {isReported && <div>Also, <UserLink user={userTo} /> was reported.</div>}
    </div>
  );
}

Submitted.propTypes = {
  userFrom: PropTypes.object.isRequired,
  userTo: PropTypes.object.isRequired,
  isReported: PropTypes.bool.isRequired,
  isPublic: PropTypes.bool.isRequired
};
