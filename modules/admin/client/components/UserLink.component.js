// External dependencies
import React from 'react';
import PropTypes from 'prop-types';

export default function UserLink({ user }) {
  if (!user || !user._id) {
    return <em>Unknown</em>;
  }

  const { _id, displayName, username } = user;
  return (
    <a href={`/admin/user?id=${_id}`} title="Show user report card">
      {displayName || username || _id}
    </a>
  );
}

UserLink.propTypes = {
  user: PropTypes.object.isRequired,
};
