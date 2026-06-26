// External dependencies
import React from 'react';
import PropTypes from 'prop-types';

export default function UserLink({ user }) {
  if (!user || !user._id) {
    return <em>Unknown</em>;
  }

  const { _id, displayName, username } = user;
  const label =
    username && displayName
      ? `${username} (${displayName})`
      : username || displayName || 'Unknown member';
  return <a href={`/admin/user?id=${_id}`}>{label}</a>;
}

UserLink.propTypes = {
  user: PropTypes.object.isRequired,
};
