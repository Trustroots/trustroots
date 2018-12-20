import React from 'react';
import PropTypes from 'prop-types';

/**
 * Link to a user
 * It shows as a displayName with a link to user's profile
 * @param {User} user - user to link to
 */
export default function UserLink({ user }) {
  return (<strong><a href={`/profile/${user.username}`}>{user.displayName || user.username}</a></strong>);
}

UserLink.propTypes = {
  user: PropTypes.object.isRequired
};
