import PropTypes from 'prop-types';
import React from 'react';

/**
 * Link to a user
 * @param {User} user - user to link to
 * @param {string} user.displayName
 * @param {string} user.username
 */
export default function UserLink({ user }) {
  return (
    <a href={`/profile/${user.username}`}>
      {user.displayName || user.username}
    </a>
  );
}

UserLink.propTypes = {
  user: PropTypes.object.isRequired,
};
