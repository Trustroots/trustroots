// External dependencies
import React from 'react';
import PropTypes from 'prop-types';
import { getAdminUserHref } from '../utils/member-url';

interface UserSummary {
  _id?: string;
  displayName?: string;
  username?: string;
}

export default function UserLink({
  user,
  publicProfile = false,
}: {
  user?: UserSummary | null;
  publicProfile?: boolean;
}) {
  if (!user || !user._id) {
    return <em>Unknown</em>;
  }

  const { _id, displayName, username } = user;
  const label =
    username && displayName
      ? `${username} (${displayName})`
      : username || displayName || 'Unknown member';
  if (publicProfile) {
    return username ? (
      <a href={`/profile/${username}`}>{label}</a>
    ) : (
      <span>{label}</span>
    );
  }
  return <a href={getAdminUserHref({ _id, username })}>{label}</a>;
}

UserLink.propTypes = {
  user: PropTypes.object.isRequired,
  publicProfile: PropTypes.bool,
};
